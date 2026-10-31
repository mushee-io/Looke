import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import solc from "solc";

const file="contracts/LookeCoinFactory.sol";
const source=fs.readFileSync(file,"utf8");
const input={
  language:"Solidity",
  sources:{[file]:{content:source}},
  settings:{optimizer:{enabled:true,runs:200},outputSelection:{"*":{"*":["abi","evm.bytecode.object"]}}}
};
function findImports(p){
  const safe=path.resolve("node_modules",p);
  if(!safe.startsWith(path.resolve("node_modules")+path.sep))return {error:"Invalid import"};
  try{return {contents:fs.readFileSync(safe,"utf8")};}
  catch{return {error:"Import missing: "+p};}
}
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:findImports}));
const errors=(output.errors??[]).filter(e=>e.severity==="error");
if(errors.length){console.error(errors.map(x=>x.formattedMessage).join("\n"));process.exit(1);}
for(const name of ["LookeCoin","LookeCoinFactory"]){
 const contract=output.contracts?.[file]?.[name];
 if(!contract?.evm?.bytecode?.object)throw Error("Missing compiled contract: "+name);
 if(name==="LookeCoinFactory"){
  const methods=contract.abi.filter(x=>x.type==="function").map(x=>x.name);
  if(!methods.includes("createCoin")||!methods.includes("coinFor"))throw Error("Factory ABI incomplete");
 }
 console.log(name+" compiles, ABI entries: "+contract.abi.length);
}
console.log("ABI and bytecode compile OK. This is NOT a security audit or on-chain deployment.");
