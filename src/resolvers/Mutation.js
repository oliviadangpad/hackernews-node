const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { APP_SECRET, getUserId } = require("../utils");

async function signup(parent, args, context, info) {
  // 1 In the signup mutation, the first thing to do is encrypt the User’s password using the bcryptjs library
  const password = await bcrypt.hash(args.password, 10);

  // 2 use your PrismaClient instance (via prisma as we covered in the steps about context) to store the new User record in the database
  const user = await context.prisma.user.create({
    data: { ...args, password },
  });

  // 3 You’re then generating a JSON Web Token which is signed with an APP_SECRET.
  // You still need to create this APP_SECRET and also install the jwt library that’s used here.
  const token = jwt.sign({ userId: user.id }, APP_SECRET);

  // 4 return the token and the user in an object that adheres to the shape of an AuthPayload object from your GraphQL schema.
  return {
    token,
    user,
  };
}

async function login(parent, args, context, info) {
  // 1 using your PrismaClient instance to retrieve an existing User record by the email address
  const user = await context.prisma.user.findUnique({
    where: { email: args.email },
  });
  if (!user) {
    throw new Error("No such user found");
  }

  // 2
  const valid = await bcrypt.compare(args.password, user.password);
  if (!valid) {
    throw new Error("Invalid password");
  }

  const token = jwt.sign({ userId: user.id }, APP_SECRET);

  // 3
  return {
    token,
    user,
  };
}

async function post(parent, args, context, info) {
  const { userId } = context;

  const newLink = await context.prisma.link.create({
    data: {
      url: args.url,
      description: args.description,
      postedBy: { connect: { id: userId } },
    },
  });
  context.pubsub.publish("NEW_LINK", newLink);

  return newLink;
}

async function vote(parent, args, context, info) {
  // 1
  const userId = context.userId;

  // 2
  const vote = await context.prisma.vote.findUnique({
    where: {
      linkId_userId: {
        linkId: Number(args.linkId),
        userId: userId,
      },
    },
  });

  if (Boolean(vote)) {
    throw new Error(`Already voted for link: ${args.linkId}`);
  }

  // 3
  const newVote = context.prisma.vote.create({
    data: {
      user: { connect: { id: userId } },
      link: { connect: { id: Number(args.linkId) } },
    },
  });
  context.pubsub.publish("NEW_VOTE", newVote);

  return newVote;
}

module.exports = {
  post,
  signup,
  login,
  vote,
};