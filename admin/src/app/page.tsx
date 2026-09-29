import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold">홈페이지 관리자</h1>
      <p className="text-zinc-600">로그인과 콘텐츠 관리 화면이 이곳에 추가됩니다.</p>
      <Link href="/harness" className="text-sm text-blue-700 underline">개발 하네스 대시보드 (로컬 전용)</Link>
    </main>
  );
}
