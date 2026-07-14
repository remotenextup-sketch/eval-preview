// =============================================
// gmail-sync.gs — CS Platform Gmail 差分同期
// =============================================
// 使い方:
//   1. Google Apps Script に貼り付け
//   2. MY_EMAILS / CS_PLATFORM_INTAKE_URL / CS_PLATFORM_API_KEY を設定
//   3. syncGmailMessages_ を 数分おきにトリガー設定
//
// 返信経路について:
//   CS Platform（actions.ts Nodemailer）が唯一の返信経路。
//   このスクリプトは「受信メールの取込」と「送信メールの同期」のみを行う。
//   sendEmailFromPage_LEGACY_ は Notion UI 旧フロー専用。
//   CS Platform から返信済みの案件では絶対に呼ばないこと（二重送信になる）。
// =============================================

// =============================================
// 設定値（環境に合わせて変更してください）
// =============================================
var MY_EMAILS = [
  'info@nextup.jp',           // メインアドレス
  // 'alias@nextup.jp',       // エイリアスがあれば追加
]
var CS_PLATFORM_INTAKE_URL = 'https://your-cs-platform.vercel.app/api/inquiries/intake'
var CS_PLATFORM_API_KEY = ''  // CS_INTAKE_API_KEY 環境変数と合わせる
var GMAIL_SEARCH_MAX_THREADS = 50  // 1回あたりの最大スレッド数
var SYNC_BUFFER_MS = 2 * 60 * 1000 // 2分バッファ（重複取込はplatform側で防止）
var INITIAL_LOOKBACK_DAYS = 30      // 初回同期は過去30日分

// Script Properties キー
var LAST_SYNC_KEY = 'lastSyncTimestamp'

// =============================================
// メイン: 差分同期（トリガーで定期実行）
// =============================================
function syncGmailMessages_() {
  var props = PropertiesService.getScriptProperties()
  var lastSync = props.getProperty(LAST_SYNC_KEY)

  // 初回は INITIAL_LOOKBACK_DAYS 日前から、以降はバッファ付きで前回時刻から
  var sinceMs = lastSync
    ? new Date(lastSync).getTime() - SYNC_BUFFER_MS
    : Date.now() - INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000

  var sinceDate = new Date(sinceMs)
  // Gmail の after: は日付単位なので、バッファより少し前の日付を指定
  var afterStr = Utilities.formatDate(sinceDate, 'UTC', 'yyyy/MM/dd')

  Logger.log('syncGmailMessages_: searching after=' + afterStr + ' (sinceDate=' + sinceDate.toISOString() + ')')

  // in:anywhere で送受信両方を取得（ゴミ箱・スパムは除外したい場合は適宜調整）
  var threads = GmailApp.search('in:anywhere after:' + afterStr, 0, GMAIL_SEARCH_MAX_THREADS)
  Logger.log('Found ' + threads.length + ' threads')

  var sent = 0, skipped = 0, errors = 0

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i]
    var messages = thread.getMessages()

    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j]
      // バッファ前のメッセージはスキップ（重複はplatform側でも防止）
      if (msg.getDate().getTime() < sinceDate.getTime()) continue

      var result = callCsPlatformEmailIntake_(thread, msg)
      if (result === null) {
        errors++
      } else if (result.skipped) {
        skipped++
      } else {
        sent++
      }
    }
  }

  // 処理成功後に最終同期日時を更新
  props.setProperty(LAST_SYNC_KEY, new Date().toISOString())
  Logger.log('Done: sent=' + sent + ', skipped=' + skipped + ', errors=' + errors)
}

// =============================================
// 手動リセット（初回 or 再同期したい場合に実行）
// =============================================
function resetLastSync_() {
  PropertiesService.getScriptProperties().deleteProperty(LAST_SYNC_KEY)
  Logger.log('Last sync timestamp cleared. Next run will fetch ' + INITIAL_LOOKBACK_DAYS + ' days of history.')
}

// =============================================
// CS Platform intake API へ送信
// 戻り値: APIレスポンスオブジェクト or null（エラー時）
// =============================================
function callCsPlatformEmailIntake_(thread, message) {
  var fromRaw = message.getFrom()
  var fromEmail = extractEmailAddress_(fromRaw)
  var isOutbound = MY_EMAILS.some(function(e) {
    return fromEmail.toLowerCase() === e.toLowerCase()
  })

  var orderNumber = extractOrderNumber_(message.getSubject() + ' ' + message.getPlainBody())

  var payload = {
    source_channel: 'email',
    external_inquiry_id: thread.getId(),   // 後方互換
    gmail_thread_id: thread.getId(),
    gmail_message_id: message.getId(),
    rfc_message_id: message.getHeader('Message-ID'),
    direction: isOutbound ? 'outbound' : 'inbound',
    from: fromRaw,
    to: message.getTo(),
    subject: message.getSubject(),
    body: message.getPlainBody(),
    from_email: fromEmail,
    customer_name: isOutbound ? null : extractDisplayName_(fromRaw),
    order_number: orderNumber,
    received_at: message.getDate().toISOString(),
    is_completed: false,
    raw_payload: {
      gmail_thread_id: thread.getId(),
      gmail_message_id: message.getId(),
    }
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: CS_PLATFORM_API_KEY ? { 'x-api-key': CS_PLATFORM_API_KEY } : {}
  }

  try {
    var response = UrlFetchApp.fetch(CS_PLATFORM_INTAKE_URL, options)
    var code = response.getResponseCode()
    var text = response.getContentText()

    if (code !== 200) {
      Logger.log('[ERROR] intake returned ' + code + ': ' + text.substring(0, 200))
      return null
    }

    var result = JSON.parse(text)
    if (!result.ok) {
      Logger.log('[WARN] intake not ok: ' + JSON.stringify(result))
    }
    return result
  } catch (e) {
    Logger.log('[ERROR] fetch failed: ' + e.message)
    return null
  }
}

// =============================================
// ヘルパー: メールアドレス抽出
// "Display Name <email@example.com>" → "email@example.com"
// =============================================
function extractEmailAddress_(raw) {
  if (!raw) return ''
  var match = raw.match(/<([^>]+)>/)
  return match ? match[1].trim() : raw.trim()
}

// =============================================
// ヘルパー: 表示名抽出
// "Display Name <email@example.com>" → "Display Name"
// =============================================
function extractDisplayName_(raw) {
  if (!raw) return null
  var match = raw.match(/^([^<]+)</)
  if (match) {
    var name = match[1].trim().replace(/^["']|["']$/g, '')
    return name || null
  }
  return null
}

// =============================================
// ヘルパー: 注文番号抽出（件名・本文から）
// 楽天注文番号パターン: 数字-数字-数字-数字 (例: 1234-56789012-1234567)
// =============================================
function extractOrderNumber_(text) {
  if (!text) return null
  var match = text.match(/\b(\d{4}-\d{8,}-\d{7})\b/)
  return match ? match[1] : null
}

// =============================================
// [LEGACY] Notion UIからの返信（旧フロー・廃止予定）
//
// ⚠ 注意: CS Platform（actions.ts）からの返信が有効な場合は
//         絶対にこの関数を呼ばないこと（二重送信になる）。
//         Notion 連携が完全に廃止されたらこの関数ごと削除すること。
//
// 使用する場合: Notion ページの gmailThreadId プロパティを渡す
// =============================================
function sendEmailFromPage_LEGACY_(to, subject, bodyText, htmlBody, gmailThreadId) {
  Logger.log('[LEGACY] sendEmailFromPage_ called for thread: ' + gmailThreadId)

  var thread = gmailThreadId ? GmailApp.getThreadById(gmailThreadId) : null
  if (!thread) {
    Logger.log('[LEGACY] Thread not found, sending new email to: ' + to)
    GmailApp.sendEmail(to, subject, bodyText, { htmlBody: htmlBody })
    return
  }

  // 最新の inbound メッセージを探して返信（outbound への誤返信を防ぐ）
  var messages = thread.getMessages()
  var targetMsg = null
  for (var i = messages.length - 1; i >= 0; i--) {
    var from = extractEmailAddress_(messages[i].getFrom())
    var isMine = MY_EMAILS.some(function(e) {
      return from.toLowerCase() === e.toLowerCase()
    })
    if (!isMine) {
      targetMsg = messages[i]
      break
    }
  }

  // alias の存在確認（存在しない alias を指定するとエラーになる）
  var aliases = GmailApp.getAliases()
  var fromEmail = MY_EMAILS[0] || ''
  var fromAlias = (fromEmail && aliases.indexOf(fromEmail) !== -1) ? fromEmail : null

  var options = {
    htmlBody: htmlBody || bodyText.replace(/\n/g, '<br>'),
  }
  if (fromAlias) {
    options.from = fromAlias
  }

  try {
    if (targetMsg) {
      targetMsg.reply(bodyText, options)
      Logger.log('[LEGACY] Replied to latest inbound message in thread')
    } else {
      // inbound がない（自分のメールのみのスレッド）はスレッドに返信
      thread.reply(bodyText, options)
      Logger.log('[LEGACY] Replied to thread (no inbound message found)')
    }
  } catch (e) {
    Logger.log('[LEGACY] Reply failed: ' + e.message + ', falling back to new email')
    GmailApp.sendEmail(to, subject, bodyText, { htmlBody: htmlBody })
  }
}
