"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const Stela = (props) => {
    const { width, height, isBold, title, titleColor, titleSize, nameColor, nameSize, subColor, subSize, priceColor, priceSize, backgroundColor, isCondensed, lineHeight, items, paddingTop, fontName, } = props;
    return (<div className={'stela'}>
      <h3>{title}</h3>
      <ul>
        {items.filter(item => item.isVisible).map((item, index) => {
        return (<li key={item.id || index}>
              
              <div className="name">{item.name}</div>
              {item.subName && <div className="sub">{item.subName}</div>}
              <div className="price">
                {Number(item.price).toFixed(2)}
              </div>
            </li>);
    })}
      </ul>
      
      <style jsx>{`
          .stela {
            padding-top: ${paddingTop}px;
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
            font-size: ${subSize}px;
            font-weight: normal;
            font-family: ${fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName}, sans-serif;
            color: ${subColor};
          }

          .price {
            flex: 1 0;
            text-align: right;
            color: ${priceColor};
            font-size: ${priceSize}px;
          }

          .neon {
            animation: neon 1.5s ease-in-out infinite alternate;
          }

          @keyframes neon {
            from {
              text-shadow:
                0 0 10px #fff,
                0 0 20px #fff,
                0 0 30px #fff,
                0 0 40px #f17,
                0 0 70px #f17,
                0 0 80px #f17,
                0 0 100px #f17,
                0 0 150px #f17;
            }

            to {
              text-shadow:
                0 0 5px #fff,
                0 0 10px #fff,
                0 0 15px #fff,
                0 0 20px #F17,
                0 0 35px #F17,
                0 0 40px #F17,
                0 0 50px #F17,
                0 0 75px #F17;
            }
          }
        `}</style>
      
      <style global jsx>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html,
          body {
            -webkit-font-smoothing: antialiased;
            font-family: ${fontName === 'Ubuntu'
        ? `Ubuntu${isCondensed ? ' Condensed' : ''}`
        : fontName}, sans-serif;
            /*font-family: LCDnova, sans-serif;*/
            height: 100%;
            overflow: hidden;
            line-height: ${lineHeight};
          }
        `}</style>
    </div>);
};
exports.default = Stela;
//# sourceMappingURL=index.jsx.map