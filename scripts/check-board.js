const { Connection, PublicKey } = require("@solana/web3.js");
const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const main = async () => {
    console.log(process.env);

  /* const connection = new Connection(process.env.RPC_ENDPOINT);
  const [boardPublicKey] = await PublicKey.findProgramAddress(
    [
      Buffer.from("board", "utf8"),
      new BN(process.env.REPOSITORY_ID).toArrayLike(Buffer, "le", 4),
    ],
    new PublicKey(process.env.PROGRAM_ID)
  ); */
  
  // get all issues with a bounty enabled

  // get each of the bounties' vaults

  // update the bounty enabled comment of each of the respective issues
};

main();
