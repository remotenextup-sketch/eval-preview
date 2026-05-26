import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EvaluationProgress from './EvaluationProgress';
import Sticky from './Sticky';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EvaluationProgress />} />
        <Route path="/sticky" element={<Sticky />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
