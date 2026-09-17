import { Outlet } from "react-router-dom";

import { DashboardSidebar } from "@/widgets/dashboard-sidebar";
import { Header } from "@/widgets/header";

import styles from "./DashboardLayout.module.css";

export const DashboardLayout = () => {
  return (
    <div className={styles.layout} data-layout="dashboard">
      <Header />
      <div className={styles.body}>
        <DashboardSidebar />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
