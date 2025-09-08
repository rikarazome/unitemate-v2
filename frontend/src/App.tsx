import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import UnitemateApp from "./components/UnitemateApp";
import AdminControl from "./components/AdminControl";
import Shop from "./components/Shop";
import About from "./components/About";
import Terms from "./components/Terms";
import Tools from "./components/Tools";
import PrivacyPolicy from "./components/PrivacyPolicy";
import CommercialTransaction from "./components/CommercialTransaction";
import { initializeBadges } from "./hooks/useBadges";

function App() {
  // アプリ開始時に勲章データをプリロード
  useEffect(() => {
    initializeBadges();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<UnitemateApp />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/about" element={<About />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/tools" element={<Tools />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/commercial" element={<CommercialTransaction />} />
      <Route path="/admin_control" element={<AdminControl />} />
      <Route path="*" element={<UnitemateApp />} />
    </Routes>
  );
}

export default App;
