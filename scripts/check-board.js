const { createAppAuth } = require("@octokit/auth-app");
const { request } = require("@octokit/request");
const { Octokit } = require("@octokit/rest");

const main = async ({
  appId,
  installationId,
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
  const { data: repository } = await appOctokit.repos.get({
    owner,
    repo: repoName,
  });

  console.log({ repository });
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

  console.log({ issuesForRepo });

  issuesForRepo.forEach(async (issue) => {
    // find bounty enabled comment
    const { data: issueComments } = await appOctokit.issues.listComments({
      owner,
      repo: repoName,
      issue_number: issue.number,
    });

    console.log({ issueComments });

    const bountyEnabledComment = issueComments.data.find(
      (comment) =>
        comment.user === appId &&
        comment.body.toLowerCase().includes("bounty enabled")
    );

    console.log({ bountyEnabledComment });

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
  privateKey: process.env.PRIVATE_KEY,
  githubRepository: process.env.GITHUB_REPOSITORY,
  programId: process.env.PROGRAM_ID,
  rpcEndpoint: process.env.RPC_ENDPOINT,
});
