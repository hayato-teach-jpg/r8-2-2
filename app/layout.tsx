import type { Metadata } from 'next';
export const metadata:Metadata={title:'九九スターバトル',description:'2台のタブレットで部屋番号を使って九九対戦。アカウント登録不要。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>}
