import * as d3Sankey from "d3-sankey";
import * as d3 from "d3";

export function SankeyChart(
  {
    nodes, // an iterable of node objects (typically [{id}, …]); implied by links if missing
    links, // an iterable of link objects (typically [{source, target}, …])
  },
  {
    format = ",", // a function or format specifier for values in titles
    align = "justify", // convenience shorthand for nodeAlign
    nodeId = (d) => d.id, // given d in nodes, returns a unique identifier (string)
    nodeGroup, // given d in nodes, returns an (ordinal) value for color
    nodeGroups, // an array of ordinal values representing the node groups
    nodeLabel, // given d in (computed) nodes, text to label the associated rect
    nodeTitle = (d) => `${d.id}\n${format(d.value)}`, // given d in (computed) nodes, hover text
    nodeAlign = align, // Sankey node alignment strategy: left, right, justify, center
    nodeWidth = 15, // width of node rects
    nodePadding = 10, // vertical separation between adjacent nodes
    nodeLabelPadding = 6, // horizontal separation between node and label
    nodeStroke = "currentColor", // stroke around node rects
    nodeStrokeWidth, // width of stroke around node rects, in pixels
    nodeStrokeOpacity, // opacity of stroke around node rects
    nodeStrokeLinejoin, // line join for stroke around node rects
    linkSource = ({ source }) => source, // given d in links, returns a node identifier string
    linkTarget = ({ target }) => target, // given d in links, returns a node identifier string
    linkValue = ({ value }) => value, // given d in links, returns the quantitative value
    linkPath = d3Sankey.sankeyLinkHorizontal(), // given d in (computed) links, returns the SVG path
    linkTitle = (d) => `${d.source.id} → ${d.target.id}\n${format(d.value)}`, // given d in (computed) links
    linkColor = "source-target", // source, target, source-target, or static color
    linkStrokeOpacity = 0.5, // link stroke opacity
    linkMixBlendMode = "multiply", // link blending mode
    colors = d3.schemeTableau10, // array of colors
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    marginTop = 5, // top margin, in pixels
    marginRight = 1, // right margin, in pixels
    marginBottom = 5, // bottom margin, in pixels
    marginLeft = 1, // left margin, in pixels
  } = {}
) {
  // Convert nodeAlign from a name to a function (since d3-sankey is not part of core d3).
  if (typeof nodeAlign !== "function")
    nodeAlign =
      {
        left: d3Sankey.sankeyLeft,
        right: d3Sankey.sankeyRight,
        center: d3Sankey.sankeyCenter,
      }[nodeAlign] ?? d3Sankey.sankeyJustify;

  // Compute values.
  const LS = d3.map(links, linkSource).map(intern);
  const LT = d3.map(links, linkTarget).map(intern);
  const LV = d3.map(links, linkValue);
  if (nodes === undefined) nodes = Array.from(d3.union(LS, LT), (id) => ({ id }));
  const N = d3.map(nodes, nodeId).map(intern);
  const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);

  // Replace the input nodes and links with mutable objects for the simulation.
  nodes = d3.map(nodes, (_, i) => ({ id: N[i] }));
  links = d3.map(links, (_, i) => ({ source: LS[i], target: LT[i], value: LV[i] }));

  // Ignore a group-based linkColor option if no groups are specified.
  if (!G && ["source", "target", "source-target"].includes(linkColor))
    linkColor = "currentColor";

  // Compute default domains.
  if (G && nodeGroups === undefined) nodeGroups = G;

  // Construct the scales.
  const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);

  // Compute the Sankey layout.
  d3Sankey
    .sankey()
    .nodeId(({ index: i }) => N[i])
    .nodeAlign(nodeAlign)
    .nodeWidth(nodeWidth)
    .nodePadding(nodePadding)
    .extent([
      [marginLeft, marginTop],
      [width - marginRight, height - marginBottom],
    ])({ nodes, links });

  // Compute titles and labels using layout nodes, so as to access aggregate values.
  if (typeof format !== "function") format = d3.format(format);
  const Tl =
    nodeLabel === undefined ? N : nodeLabel == null ? null : d3.map(nodes, nodeLabel);
  const Tt = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
  const Lt = linkTitle == null ? null : d3.map(links, linkTitle);

  // A unique identifier for clip paths (to avoid conflicts).
  const uid = `O-${Math.random().toString(16).slice(2)}`;

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  const node = svg
    .append("g")
    .attr("stroke", nodeStroke)
    .attr("stroke-width", nodeStrokeWidth)
    .attr("stroke-opacity", nodeStrokeOpacity)
    .attr("stroke-linejoin", nodeStrokeLinejoin)
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("width", (d) => d.x1 - d.x0);

  if (G) node.attr("fill", ({ index: i }) => color(G[i]));
  if (Tt) node.append("title").text(({ index: i }) => Tt[i]);

  const link = svg
    .append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", linkStrokeOpacity)
    .selectAll("g")
    .data(links)
    .join("g")
    .style("mix-blend-mode", linkMixBlendMode);

  if (linkColor === "source-target")
    link
      .append("linearGradient")
      .attr("id", (d) => `${uid}-link-${d.index}`)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", (d) => d.source.x1)
      .attr("x2", (d) => d.target.x0)
      .call((gradient) =>
        gradient
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", ({ source: { index: i } }) => color(G[i]))
      )
      .call((gradient) =>
        gradient
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", ({ target: { index: i } }) => color(G[i]))
      );

  link
    .append("path")
    .attr("d", linkPath)
    .attr(
      "stroke",
      linkColor === "source-target"
        ? ({ index: i }) => `url(#${uid}-link-${i})`
        : linkColor === "source"
        ? ({ source: { index: i } }) => color(G[i])
        : linkColor === "target"
        ? ({ target: { index: i } }) => color(G[i])
        : linkColor
    )
    .attr("stroke-width", ({ width }) => Math.max(1, width))
    .call(Lt ? (path) => path.append("title").text(({ index: i }) => Lt[i]) : () => {});

  if (Tl)
    svg
      .append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("x", (d) =>
        d.x0 < width / 2 ? d.x1 + nodeLabelPadding : d.x0 - nodeLabelPadding
      )
      .attr("y", (d) => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
      .text(({ index: i }) => Tl[i]);

  function intern(value) {
    return value !== null && typeof value === "object" ? value.valueOf() : value;
  }

  return Object.assign(svg.node(), { scales: { color } });
}

export const testData = [
  { source: "H2 conversion", target: "Losses", value: 6.242 },
  { source: "H2", target: "Road transport", value: 20.897 },
  { source: "Hydro", target: "Electricity grid", value: 6.995 },
  { source: "Liquid", target: "Industry", value: 121.066 },
  { source: "Liquid", target: "International shipping", value: 128.69 },
  { source: "Liquid", target: "Road transport", value: 135.835 },
  { source: "Liquid", target: "Domestic aviation", value: 14.458 },
  { source: "Liquid", target: "International aviation", value: 206.267 },
  { source: "Liquid", target: "Agriculture", value: 3.64 },
  { source: "Liquid", target: "National navigation", value: 33.218 },
  { source: "Liquid", target: "Rail transport", value: 4.413 },
  { source: "Marine algae", target: "Bio-conversion", value: 4.375 },
  { source: "Ngas", target: "Gas", value: 122.952 },
  { source: "Nuclear", target: "Thermal generation", value: 839.978 },
  { source: "Oil imports", target: "Oil", value: 504.287 },
  { source: "Oil reserves", target: "Oil", value: 107.703 },
  { source: "Oil", target: "Liquid", value: 611.99 },
  { source: "Other waste", target: "Solid", value: 56.587 },
  { source: "Other waste", target: "Bio-conversion", value: 77.81 },
  { source: "Pumped heat", target: "Heating and cooling - homes", value: 193.026 },
  { source: "Pumped heat", target: "Heating and cooling - commercial", value: 70.672 },
  { source: "Solar PV", target: "Electricity grid", value: 59.901 },
  { source: "Solar Thermal", target: "Heating and cooling - homes", value: 19.263 },
  { source: "Solar", target: "Solar Thermal", value: 19.263 },
  { source: "Solar", target: "Solar PV", value: 59.901 },
  { source: "Solid", target: "Agriculture", value: 0.882 },
  { source: "Solid", target: "Thermal generation", value: 400.12 },
  { source: "Solid", target: "Industry", value: 46.477 },
  { source: "Thermal generation", target: "Electricity grid", value: 525.531 },
  { source: "Thermal generation", target: "Losses", value: 787.129 },
  { source: "Thermal generation", target: "District heating", value: 79.329 },
  { source: "Tidal", target: "Electricity grid", value: 9.452 },
  { source: "UK land based bioenergy", target: "Bio-conversion", value: 182.01 },
  { source: "Wave", target: "Electricity grid", value: 19.013 },
  { source: "Wind", target: "Electricity grid", value: 289.366 },
];

export const testData2 = [
  { source: "Wind", target: "Electricity grid", value: 289.366 },
  { source: "Wind", target: "Electricity grid", value: 289.366 },
  { source: "Wind", target: "Electricity grid", value: 289.366 },
  { source: "Wind", target: " grid", value: 289.366 },
  { source: "Wind", target: " grid", value: 289.366 },
  { source: "Wind", target: " grid", value: 289.366 },
  { source: "Wind", target: " grid", value: 289.366 },
];

export const testData3 = [
  {
    Txhash: "0x1130ee8865df77efc9024f7e3147b486fec26eba6ddc50d903b819b61d24c450",
    Blockno: "12753422",
    UnixTimestamp: "1637247047",
    DateTime: "11/18/21 14:50",
    source: "0x207ec3c3bcc212a5d672677764c0a28d5aba7ddb",
    target: "0xd6d206f59cc5a3bfa4cc10bc8ba140ac37ad1c89",
    value: 1.124,
    Method: "Add Liquidity ETH",
  },
  {
    Txhash: "0x47653c072150078b2e02e2c769a8e3a681dfa7ee56762d45096aec6848d97a46",
    Blockno: "12753424",
    UnixTimestamp: "1637247056",
    DateTime: "11/18/21 14:50",
    source: "0x207ec3c3bcc212a5d672677764c0a28d5aba7ddb",
    target: "0xd6d206f59cc5a3bfa4cc10bc8ba140ac37ad1c89",
    value: 1.324,
    Method: "0xa2abe54e",
  },
  {
    Txhash: "0x6a85a741867a50e8ea9cbcfed39837e09cc24ac33dc16699d43f6d1eee5e4aca",
    Blockno: "12753424",
    UnixTimestamp: "1637247056",
    DateTime: "11/18/21 14:50",
    source: "0x207ec3c3bcc212a5d672677764c0a28d5aba7ddb",
    target: "0xd6d206f59cc5a3bfa4cc10bc8ba140ac37ad1c89",
    value: 1.1324,
    Method: "0xa56aeb38",
  },
  {
    Txhash: "0x92129e253686b7a6cf91483725162dff5e05bee7bf97ad0247871ea2260227ff",
    Blockno: "12753424",
    UnixTimestamp: "1637247056",
    DateTime: "11/18/21 14:50",
    source: "0xd2c0d0251a6e074e0ad3e6edf1c3f859e52b9b92",
    target: "0xd6d206f59cc5a3bfa4cc10bc8ba140ac37ad1c89",
    value: 5.134,
    Method: "0xa56aeb38",
  },
  {
    Txhash: "0xcdb9b0ba03f0036f913eb25fe4ae89c970d8c4105dc210d656b884c3ad55ae5f",
    Blockno: "12753426",
    UnixTimestamp: "1637247062",
    DateTime: "11/18/21 14:51",
    source: "0xd2c0d0251a6e074e0ad3e6edf1c3f859e52b9b92",
    target: "0xd6d206f59cc5a3bfa4cc10bc8ba140ac37ad1c89",
    value: 5.51324,
    Method: "0xa56aeb38",
  },
  {
    Txhash: "0x86e41ffaae4c88655d43d4ff5cbd4c248a2e03ada13a926ff9e828757c63d1e9",
    Blockno: "12753486",
    UnixTimestamp: "1637247258",
    DateTime: "11/18/21 14:54",
    source: "0xd2c0d0251a6e074e0ad3e6edf1c3f859e52b9b92",
    target: "0xd6d206f59cc5a3bfa4cc10bc8ba140ac37ad1c89",
    value: 3.1235,
    Method: "0xa56aeb38",
  },
];
