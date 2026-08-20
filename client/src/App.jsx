import { Routes, Route } from "react-router-dom";
import Play from "./pages/Play.jsx";
import Control from "./pages/Control.jsx";
import Display from "./pages/Display.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Play />} />
      <Route path="/play" element={<Play />} />
      <Route path="/control" element={<Control />} />
      <Route path="/display" element={<Display />} />
    </Routes>
  );
}
