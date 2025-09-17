import { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon(props: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <>
            <img {...props} src="/streamff-logo3.png" alt="App Logo" />
        </>
    );
}
