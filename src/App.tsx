import { CartProvider } from "./state/cart";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Beats from "./components/Beats";
import Licenses from "./components/Licenses";
import Lessons from "./components/Lessons";
import About from "./components/About";
import Faq from "./components/Faq";
import Contact from "./components/Contact";
import Player from "./components/Player";
import LicenseModal from "./components/LicenseModal";
import CartDrawer from "./components/CartDrawer";
import ScrollFx from "./components/ScrollFx";

export default function App() {
  return (
    <CartProvider>
      <a className="skip-link" href="#beats">
        דלג לחנות הביטים
      </a>
      <Header />
      <ScrollFx>
        <Hero />
        <Beats />
        <Licenses />
        <Lessons />
        <About />
        <Faq />
        <Contact />
      </ScrollFx>
      <Player />
      <LicenseModal />
      <CartDrawer />
    </CartProvider>
  );
}
