import * as d3 from "d3";
import { useEffect, useRef } from "react";
import tokenData from "./data/quidd-bsc-transfers-0x7961Ade0a767c0E5B67Dd1a1F78ba44F727642Ed.csv";
import { SankeyChart, testData, testData2, testData3 } from "./sankey-create";

const POLKASTARTER = "0xee62650fa45ac0deb1b24ec19f983a8f85b727ab";
const MINT = "0x0000000000000000000000000000000000000000";
const OWNER = "0x72571d815dd31fbde52be0b9d7ffc8344aede616";
const PANCAKE_SWAP = "0xd6d206f59cc5a3bfa4cc10bc8ba140ac37ad1c89";
const JUMP_1 = "jump 1";
const JUMP_2 = "jump 2";

const POLKASTARTER_TITLE = "POLKASTARTER";
const PANCAKE_SWAP_TITLE = "PANCAKE_SWAP";
const GREEN_ZONE = "GREEN_ZONE";

const COLORS = {
  [JUMP_1]: "yellow",
  [POLKASTARTER_TITLE]: "blue",
  [PANCAKE_SWAP_TITLE]: "red",
  [JUMP_2]: "pink",
  [GREEN_ZONE]: "green",
};

const convertData = (transaction) => {
  return {
    value: Number(transaction.Quantity.replace(/,/gi, "")),
    source: transaction.From,
    target: transaction.To,
    tHash: transaction.T,
  };
};

const turnToValidData = (value) => {
  return Number(value.replace(/,/gi, ""));
};

function App() {
  const chartRef = useRef(null);

  useEffect(() => {
    let svgElement;
    let chartRefInsideEffect = chartRef;

    d3.csv(tokenData).then((csvAsArray) => {
      const getOnlyDomainIsPolkaStarter = (transactions) => {
        const domainIsPolkaStarter = new Set([POLKASTARTER]);

        let toJump1 = { source: POLKASTARTER_TITLE, target: JUMP_1, value: 0 };
        let toJump2 = { source: JUMP_1, target: JUMP_2, value: 0 };
        let toPancakeSwap = { source: JUMP_1, target: PANCAKE_SWAP_TITLE, value: 0 };
        let toGreenZone = { source: JUMP_1, target: GREEN_ZONE, value: 0 };

        transactions.forEach((transaction) => {
          if (domainIsPolkaStarter.has(transaction.From)) {
            if (transaction.From === POLKASTARTER) {
              domainIsPolkaStarter.add(transaction.To);
              toJump1.value += turnToValidData(transaction.Quantity);
            } else {
              if (transaction.To !== PANCAKE_SWAP) {
                toJump2.value += turnToValidData(transaction.Quantity);
              } else {
                toPancakeSwap.value += turnToValidData(transaction.Quantity);
              }
            }
          }
        });

        const jump2_pancakeSwap_sum = toJump2.value + toPancakeSwap.value;
        toGreenZone.value = toJump1.value - jump2_pancakeSwap_sum;

        return [toPancakeSwap, toJump1, toJump2, toGreenZone];
      };

      const tokensWithPolkaStarter = getOnlyDomainIsPolkaStarter(csvAsArray);

      const sankeyChart = SankeyChart(
        { links: tokensWithPolkaStarter },
        {
          nodeGroup: (d) => {
            return COLORS[d.id];
          },
          colors: Object.values(COLORS),
          format: (
            (f) => (d) =>
              `${f(d)} Weight`
          )(d3.format(",.1~f")),
          height: 400,
          width: 1200,
        }
      );

      svgElement = sankeyChart;
      chartRefInsideEffect.current.append(sankeyChart);
    });

    return () => {
      chartRefInsideEffect.current.remove(svgElement);
    };
  }, []);

  return <div id={"sankey-chart"} ref={chartRef} />;
}

export default App;
