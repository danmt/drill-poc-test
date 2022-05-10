const { createAppAuth } = require("@octokit/auth-app");
const { request } = require("@octokit/request");
const { Octokit } = require("@octokit/rest");

const main = async ({
  appId,
  installationId,
  botId,
  privateKey,
  githubRepository,
  programId,
  rpcEndpoint,
}) => {
  // const connection = new Connection(rpcEndpoint);

  const appOctokit = new Octokit({
    auth: {
      appId,
      installationId,
      privateKey,
    },
    authStrategy: createAppAuth,
  });
  const [owner, repoName] = githubRepository.split("/");

  /* const [boardPublicKey] = await PublicKey.findProgramAddress(
    [
      Buffer.from("board", "utf8"),
      new BN(repository.id).toArrayLike(Buffer, "le", 4),
    ],
    new PublicKey(programId)
  ); */

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
        comment.user.id === botId &&
        comment.body.toLowerCase().includes("bounty enabled")
      );
    });

    console.log({ bountyEnabledComment });

    if (bountyEnabledComment !== undefined) {
      console.log(bountyEnabledComment.body.split('\n'))
    }

    /* // find bounty vault account
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
    } */
  });
};

main({
  appId: parseInt(process.env.APP_ID, 10),
  installationId: parseInt(process.env.INSTALLATION_ID, 10),
  botId: parseInt(process.env.DRILL_BOT_ID, 10),
  privateKey: process.env.PRIVATE_KEY,
  githubRepository: process.env.GITHUB_REPOSITORY,
  programId: process.env.PROGRAM_ID,
  rpcEndpoint: process.env.RPC_ENDPOINT,
});
