export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body style={{fontFamily:'system-ui',maxWidth:780,margin:'auto',padding:24}}>{children}</body></html>;
}
