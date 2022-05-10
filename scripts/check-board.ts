import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { getAccount, getMint } from "@solana/spl-token";
import { TokenListProvider } from "@solana/spl-token-registry";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

interface Config {
  appId: string;
  installationId: string;
  botId: string;
  privateKey: string;
  githubRepository: string;
  programId: string;
  rpcEndpoint: string;
  cluster: string;
}

const main = async ({
  appId,
  installationId,
  botId,
  privateKey,
  githubRepository,
  programId,
  rpcEndpoint,
  cluster,
}: Config) => {
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

  issuesForRepo.forEach(async (issue) => {
    // find bounty enabled comment
    const { data: issueComments } = await appOctokit.issues.listComments({
      owner,
      repo: repoName,
      issue_number: issue.number,
    });

    const bountyEnabledComment = issueComments.find((comment) => {
      return (
        comment.user?.id.toString() === botId &&
        comment.body?.toLowerCase().includes("bounty enabled")
      );
    });

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

      const bodyAsArray = bountyEnabledComment.body?.split("\n").filter(segment => segment !== '');

      const bountyVaultUserAmount = Number(bountyVaultAccount.amount) / Math.pow(10, acceptedMint.decimals);

      const explorerUrl = new URL(`https://explorer.solana.com/address/${bountyVaultPublicKey.toBase58()}`);

      explorerUrl.searchParams.append("cluster", cluster);

      if (cluster === "custom") {
        explorerUrl.searchParams.append("customUrl", rpcEndpoint);
      }

      let body = "";

      const tokens = await new TokenListProvider().resolve();
      const tokenList = tokens.filterByClusterSlug(cluster).getList();
      const mintDetails = tokenList.find(token => token.address === acceptedMint.address.toBase58())

      if (bodyAsArray?.length === 2) {
        body = [
          ...bodyAsArray,
          `Amount: ${bountyVaultUserAmount}**${mintDetails?.symbol ?? ' (Unknown Token)'}** [view in explorer](${explorerUrl.toString()}).`,
        ].join("\n");
      } else if (bodyAsArray?.length === 3) {
        body = [
          ...bodyAsArray.slice(0, -1),
          `Amount: ${bountyVaultUserAmount}**${mintDetails?.symbol ?? ' (Unknown Token)'}**  [view in explorer](${explorerUrl.toString()}).`,
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

if (process.env.APP_ID === undefined) {
  throw new Error('APP_ID env variable is missing.')
}

if (process.env.INSTALLATION_ID === undefined) {
  throw new Error('INSTALLATION_ID env variable is missing.')
}

if (process.env.DRILL_BOT_ID === undefined) {
  throw new Error('DRILL_BOT_ID env variable is missing.')
}

if (process.env.PRIVATE_KEY === undefined) {
  throw new Error('PRIVATE_KEY env variable is missing.')
}

if (process.env.GITHUB_REPOSITORY === undefined) {
  throw new Error('GITHUB_REPOSITORY env variable is missing.')
}

if (process.env.PROGRAM_ID === undefined) {
  throw new Error('PROGRAM_ID env variable is missing.')
}

if (process.env.RPC_ENDPOINT === undefined) {
  throw new Error('RPC_ENDPOINT env variable is missing.')
}

if (process.env.CLUSTER === undefined) {
  throw new Error('CLUSTER env variable is missing.')
}

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
