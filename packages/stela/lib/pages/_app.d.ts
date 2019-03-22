/// <reference types="socket.io-client" />
/// <reference types="react" />
import App, { NextAppContext } from 'next/app';
import { LoginProps } from '../components/LoginDialog';
import { StelaProps } from '../src/stela';
export interface IStela extends StelaProps {
    update: (props: Partial<StelaProps>) => void;
    logout?: () => void;
}
declare type State = StelaProps & {
    username?: string | null;
};
declare class StelaApp extends App<{
    session?: any;
    isNeedLogin?: boolean;
}, State> {
    socket: SocketIOClient.Socket;
    pageContext: import("../src/getPageContext").IPageContext;
    needLogin: boolean;
    static getInitialProps({ ctx, Component }: NextAppContext): Promise<{
        isNeedLogin: boolean;
        pageProps: Record<string, string | string[] | undefined>;
        session: any;
    } | {
        pageProps: {};
        isNeedLogin?: undefined;
        session?: undefined;
    }>;
    constructor(props: any);
    handleChanged: <K extends "title" | "backgroundColor" | "height" | "lineHeight" | "paddingTop" | "width" | "username" | "isCondensed" | "isBold" | "titleColor" | "titleSize" | "nameColor" | "nameSize" | "subColor" | "subSize" | "priceColor" | "priceSize" | "items" | "fontName">(props: Pick<State, K>) => void;
    update: (props: Partial<StelaProps>) => void;
    handleSubmitLogin: (values: LoginProps) => Promise<[boolean, {
        message?: string | undefined;
        passport?: {
            user: string;
        } | undefined;
    }]>;
    logout: () => void;
    handleLogout: () => void;
    componentDidMount(): void;
    componentWillUnmount(): void;
    render(): JSX.Element;
}
export default StelaApp;
//# sourceMappingURL=_app.d.ts.map