export type CoinKind = "Creator" | "Content" | "Trend";
export type Coin = {
  id: string;
  name: string;
  ticker: string;
  kind: CoinKind;
  cap: string;
  volume: string;
  holders: string;
  age: string;
  change: number;
  icon: string;
  tone: string;
  description: string;
};
export type FeedPost = {
  id: string;
  author: string;
  handle: string;
  ago: string;
  title: string;
  text: string;
  image: string;
  coinId: string;
  likes: number;
};
export type Uniq = {
  id: string;
  title: string;
  creator: string;
  edition: string;
  art: string;
  accent: string;
};

// Synthetic product fixtures. These are NOT real prices, traded assets, NFTs, accounts or on-chain activity.
export const coins: Coin[] = [
  { id:"nova", name:"Nova Arcade", ticker:"NOVA",kind:"Creator",cap:"$3.8m",volume:"$212k",holders:"4,820",age:"12d",change:12.4,icon:"✦",tone:"violet",description:"A coin concept for the next generation of game creators." },
  { id:"pixel", name:"Pixel Friends",ticker:"PIXEL",kind:"Trend",cap:"$968k",volume:"$86k",holders:"2,104",age:"8d",change:6.8,icon:"◈",tone:"lime",description:"Playful pixels, shared stories, internet culture." },
  { id:"afterglow",name:"Afterglow",ticker:"GLOW",kind:"Content",cap:"$524k",volume:"$31k",holders:"1,318",age:"3d",change:-3.2,icon:"☼",tone:"orange",description:"A digital artwork that became a conversation." },
  { id:"ultra",name:"Ultra Frequency",ticker:"FREQ",kind:"Trend",cap:"$312k",volume:"$19k",holders:"908",age:"2d",change:24.6,icon:"≋",tone:"blue",description:"An imaginary coin celebrating the Ultra creator ecosystem." },
  { id:"neon",name:"Neon Runner",ticker:"RUN",kind:"Creator",cap:"$189k",volume:"$9.6k",holders:"523",age:"1d",change:8.1,icon:"↗",tone:"pink",description:"Speed, games and late-night streams." },
  { id:"orbit",name:"Orbit Journal",ticker:"ORBIT",kind:"Content",cap:"$86k",volume:"$4.1k",holders:"242",age:"7h",change:-1.7,icon:"◉",tone:"slate",description:"A story about faraway places and close-knit communities." },
];
export const posts: FeedPost[] = [
  {id:"p1",author:"awa",handle:"@awa",ago:"5h",title:"Golden hour, on repeat",text:"Collecting quiet moments in loud places. The world looks different when you slow down.",image:"sunset",coinId:"afterglow",likes:248},
  {id:"p2",author:"nova",handle:"@novaarcade",ago:"8h",title:"The next level is ours",text:"A little visual experiment for everyone building their own universe.",image:"arcade",coinId:"nova",likes:136},
  {id:"p3",author:"milo",handle:"@milo",ago:"1d",title:"Everything in motion",text:"Shapes, colour, and the energy of starting something new.",image:"motion",coinId:"pixel",likes:92},
];
export const uniqs: Uniq[] = [
  {id:"u1",title:"Soft Signals #001",creator:"@awa",edition:"1 of 25",art:"soft",accent:"peach"},
  {id:"u2",title:"Horizon Engine",creator:"@novaarcade",edition:"1 of 100",art:"horizon",accent:"purple"},
  {id:"u3",title:"Electric Bloom",creator:"@milo",edition:"1 of 50",art:"bloom",accent:"green"},
  {id:"u4",title:"Chromatic Drift",creator:"@kira",edition:"1 of 10",art:"drift",accent:"blue"},
];
export const navFilters = ["All", "Creators", "Trends", "Content", "Gaming", "Art"] as const;
