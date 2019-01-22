import React, { Component, ReactNode } from 'react';
import io from 'socket.io-client';

enum Effect {
  none = 0,
  shine,
  neon,
}

type PriceItem = {
  name: string;
  subName?: string;
  price: number;
  isVisible?: boolean;
  effect?: Effect;
};

export interface StelaState {
  width: number;
  height: number;
  backgroundColor: string;
  isCondensed: boolean;
  isBold: boolean;
  title: string;
  titleColor?: string;
  titleSize: number;
  nameColor: string;
  nameSize: number;
  subColor: string;
  subSize: string;
  priceColor: string;
  priceSize: string;
  items: PriceItem[];
}

// type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
type Props = Partial<StelaState>;

export default class Stela extends Component<Props, StelaState> {
  socket?: SocketIOClient.Socket;

  static async getInitialProps({ req, query }): Promise<Props> {
    console.log('getInitialProps', !!req ? 'Server' : 'Client');
    const isServer = !!req;
    if (isServer) {
      console.log('Initial', query);
      return query;
    }
    return {};
    // const res = await fetch('/initial', { headers: { Accept: 'application/json' } });
    // return res.json();
  }

  constructor(props) {
    super(props);
    this.state = {
      titleColor: '#7cb5ec',
      nameColor: '#fff',
      subColor: '#e7ba00',
      priceColor: '#fff',
      isBold: true,
      items: [],
      ...props,
    };
  }

  componentDidMount(): void {
    this.socket = io();
    this.socket.on('initial', this.updateHandler);
    this.socket.on('changed', this.updateHandler);
  }

  componentWillUnmount(): void {
    if (this.socket) {
      this.socket.off('changed', this.updateHandler);
      this.socket.off('initial', this.updateHandler);
      this.socket.close();
    }
  }

  updateHandler = (props) => {
    this.setState(props);
  };

  render(): ReactNode {
    const {
      width,
      height,
      isBold,
      title,
      titleColor,
      titleSize,
      nameColor,
      nameSize,
      subColor,
      subSize,
      priceColor,
      priceSize,
      backgroundColor,
      isCondensed,
      items,
    } = this.state;
    return (
      <div className={'stela'}>
        <h3>{title}</h3>
        <ul>
          {items.map((item, index) =>
            (<li key={item.name || index}>
              <div className="name">{item.name}</div>
              {item.subName && <div className="sub">{item.subName}</div>}
              <div className="price">{item.price.toFixed(2)}</div>
            </li>))}
        </ul>
        {/* language=CSS */}
        <style global jsx>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html,
          body {
            -webkit-font-smoothing: antialiased;
            font-family: "Ubuntu${isCondensed ? ' Condensed' : ''}", sans-serif;
            height: 100%;
            overflow: hidden;
          }

        `}</style>
        {/* language=CSS */}
        <style jsx>{`
          .stela {
            width: ${width}px;
            height: ${height}px;
            background: ${backgroundColor};
            color: white;
            font-weight: ${isBold ? 'bold' : 'inherited'};
            /*font-size: 28px;*/
          }

          h3 {
            color: ${titleColor || 'inherited'};
            display: ${title ? 'inherit' : 'none'};
            text-align: center;
            font-size: ${titleSize}px;
          }

          li {
            display: flex;
          }

          li > * {
            align-self: baseline;
          }

          .name {
            flex: 0 0;
            margin-right: 2px;
            color: ${nameColor};
            font-size: ${nameSize}px;
          }

          .sub {
            overflow: hidden;
            white-space: nowrap;
            font-size: ${subSize};
            font-weight: normal;
            font-family: "Ubuntu Condensed", sans-serif;
            color: ${subColor};
          }

          .price {
            flex: 1 0;
            text-align: right;
            color: ${priceColor};
            font-size: ${priceSize}px;
          }

        `}</style>
      </div>
    );
  }
}
