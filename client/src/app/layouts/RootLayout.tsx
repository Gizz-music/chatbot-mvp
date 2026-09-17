import { Outlet } from "react-router-dom";

import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";

import { ScrollToHash } from "../router/ScrollToHash";

import styles from "./RootLayout.module.css";

export const RootLayout = () => {
  return (
    <div className={styles.layout}>
      <ScrollToHash />
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
