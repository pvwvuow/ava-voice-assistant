import { redirect } from "next/navigation";

export default function Home() {
  // رابط کاربری نرم‌افزار «آوا» به‌صورت فایل استاتیک در public/ava سرو می‌شود
  redirect("/ava/index.html");
}
