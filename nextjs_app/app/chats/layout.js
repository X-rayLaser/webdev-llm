import PageWithSidePanel from './PageWithSidePanel';


export default async function RootLayout({ children }) {
    return (
        <PageWithSidePanel>{children}</PageWithSidePanel>
    );
}