const { Connection, PublicKey } = require("@solana/web3.js");
const { Octokit } = require("@octokit/rest");
const { createAppAuth } = require("@octokit/auth-app");
const { getAccount } = require("@solana/spl-token");
const { BN } = require("bn.js");

const main = async ({
  appId,
  installationId,
  privateKey,
  githubRepository,
  programId,
  rpcEndpoint,
}) => {
  console.log({
    appId,
    installationId,
    privateKey,
    githubRepository,
    programId,
    rpcEndpoint,
  });

  console.log({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET
  })

  const appAuth = createAppAuth({
    appId,
    privateKey,
  });
  
  const installationAuth123 = await appAuth({
    type: "installation",
    installationId,
    factory: createAppAuth,
  });

  console.log({ installationAuth123 })

  const connection = new Connection(rpcEndpoint);
  const appOctokit = new Octokit({
    auth: {
      id: appId,
      installationId,
      privateKey,
    },
    authStrategy: createAppAuth,
  });
  const [repoName, owner] = githubRepository.split("/");
  const repository = await appOctokit.repos.get({
    owner,
    repo: repoName,
  });
  const [boardPublicKey] = await PublicKey.findProgramAddress(
    [
      Buffer.from("board", "utf8"),
      new BN(repository.id).toArrayLike(Buffer, "le", 4),
    ],
    new PublicKey(programId)
  );

  // get all issues with a bounty enabled
  const issuesForRepo = await appOctokit.issues.listForRepo({
    repo: repoName,
    owner,
    labels: "drill:bounty:enabled",
    state: "open",
  });

  console.log({ issuesForRepo });

  issuesForRepo.data.forEach(async (issue) => {
    // find bounty enabled comment
    const issueComments = await appOctokit.issues.listComments({
      owner: issue.repository.owner,
      repo: issue.repository.name,
      issue_number: issue.number,
    });
    const bountyEnabledComment = issueComments.data.find(
      (comment) =>
        comment.user === appId && comment.body.includes("Bounty Enabled")
    );

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

    try {
      const bountyVaultAccount = await getAccount(
        connection,
        bountyVaultPublicKey
      );
      console.log({ bountyEnabledComment, bountyVaultAccount });
    } catch (error) {
      console.erro({ error });
    }
  });
};

main({
  appId: process.env.APP_ID,
  installationId: process.env.INSTALLATION_ID,
  privateKey: process.env.PRIVATE_KEY,
  githubRepository: process.env.GITHUB_REPOSITORY,
  programId: process.env.PROGRAM_ID,
  rpcEndpoint: process.env.RPC_ENDPOINT,
});
