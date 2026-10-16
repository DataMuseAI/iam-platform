import './globals.css';

export const metadata = {
  title: 'Enterprise IAM Platform',
  description: 'Multi-Tenant Identity and Access Management Console',
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}
