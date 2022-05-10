const { createAppAuth } = require("@octokit/auth-app");
const { Octokit } = require("@octokit/rest");
const { getAccount, getMint } = require("@solana/spl-token");
const { Connection, PublicKey } = require("@solana/web3.js");
const BN = require("bn.js");

const main = async ({
  appId,
  installationId,
  botId,
  privateKey,
  githubRepository,
  programId,
  rpcEndpoint,
  cluster,
}) => {
  const connection = new Connection(rpcEndpoint);
  const appOctokit = new Octokit({
    auth: {
      appId,
      installationId,
      privateKey,
    },
    authStrategy: createAppAuth,
  });
  const [owner, repoName] = githubRepository.split("/");

  const { data: repository } = await appOctokit.repos.get({
    repo: repoName,
    owner,
  });

  const [boardPublicKey] = await PublicKey.findProgramAddress(
    [
      Buffer.from("board", "utf8"),
      new BN(repository.id).toArrayLike(Buffer, "le", 4),
    ],
    new PublicKey(programId)
  );

  // get all issues with a bounty enabled
  const { data: issuesForRepo } = await appOctokit.issues.listForRepo({
    repo: repoName,
    owner,
    labels: "drill:bounty:enabled",
    state: "open",
  });

  console.log('DA FUCK')

  issuesForRepo.forEach(async (issue) => {
    // find bounty enabled comment
    const { data: issueComments } = await appOctokit.issues.listComments({
      owner,
      repo: repoName,
      issue_number: issue.number,
    });

    console.log(issueComments);

    const bountyEnabledComment = issueComments.find((comment) => {
      
      console.log({ 'comment.user.id': comment.user.id }, {botId})
      console.log('comment.user.id === botId', comment.user.id.toString() === botId)

      return (
        comment.user.id.toString() === botId &&
        comment.body.toLowerCase().includes("bounty enabled")
      );
    });

    console.log({bountyEnabledComment})

    if (bountyEnabledComment !== undefined) {
      // find bounty vault account
      const [bountyPublicKey] = await PublicKey.findProgramAddress(
        [
          Buffer.from("bounty", "utf8"),
          boardPublicKey.toBuffer(),
          new BN(issue.number).toArrayLike(Buffer, "le", 4),
        ],
        new PublicKey(programId)
      );
      const [bountyVaultPublicKey] = await PublicKey.findProgramAddress(
        [Buffer.from("bounty_vault", "utf8"), bountyPublicKey.toBuffer()],
        new PublicKey(programId)
      );

      const bountyVaultAccount = await getAccount(
        connection,
        bountyVaultPublicKey
      );
      const acceptedMint = await getMint(
        connection,
        bountyVaultAccount.mint
      );

      const bodyAsArray = bountyEnabledComment.body.split("\n").filter(segment => segment !== '');

      const bountyVaultUserAmount = Number(bountyVaultAccount.amount) / Math.pow(10, acceptedMint.decimals);

      const explorerUrl = new URL(`https://explorer.solana.com/address/${bountyVaultPublicKey.toBase58()}`);

      console.log({ cluster, 'process.env.CLUSTER': process.env.CLUSTER });

      explorerUrl.searchParams.append("cluster", cluster);

      if (cluster === "custom") {
        explorerUrl.searchParams.append("customUrl", rpcEndpoint);
      }

      let body = "";

      console.log(bodyAsArray.length)

      if (bodyAsArray.length === 2) {
        body = [
          ...bodyAsArray,
          `Amount: ${bountyVaultUserAmount} [view in explorer](${explorerUrl.toString()})`,
        ].join("\n");
      } else if (bodyAsArray.length === 3) {
        body = [
          ...bodyAsArray.slice(0, -1),
          `Amount: ${bountyVaultUserAmount} [view in explorer](${explorerUrl.toString()})`,
        ].join("\n");
      }

      await appOctokit.issues.updateComment({
        body,
        comment_id: bountyEnabledComment.id,
        owner,
        repo: repoName,
      });
    }
  });
};

main({
  appId: process.env.APP_ID,
  installationId: process.env.INSTALLATION_ID,
  botId: process.env.DRILL_BOT_ID,
  privateKey: process.env.PRIVATE_KEY,
  githubRepository: process.env.GITHUB_REPOSITORY,
  programId: process.env.PROGRAM_ID,
  rpcEndpoint: process.env.RPC_ENDPOINT,
  cluster: process.env.CLUSTER,
});
