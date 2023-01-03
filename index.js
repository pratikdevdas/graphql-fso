require('dotenv').config()
const { ApolloServer, gql, UserInputError, AuthenticationError } = require("apollo-server");
const { v1: uuid } = require("uuid");
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const Person = require('./models/person')
const User = require('./models/user')

mongoose.connect(process.env.MONGO_URL)
  .then(() => {
  console.log('connected to MongoDB')
})
.catch((error) => {
  console.log('error connection to MongoDB:', error.message)
})

const typeDefs = gql`
  type Address {
    street: String!
    city: String!
  }

  type Person {
    name: String!
    phone: String
    address: Address!
    id: ID!
  }

  enum YesNo {
    YES
    NO
  }

  type User {
    username: String!
    friends: [Person!]!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    personCount: Int!
    allPersons(phone: YesNo): [Person!]!
    findPerson(name: String!): Person
    me: User
  }

  type Mutation {
    addPerson(
      name: String!
      phone: String!
      street: String!
      city: String!
    ): Person
    editNumber(
      name: String!
      phone: String!
    ):Person
    createUser(
      username: String!
    ):User
    login(
      username: String!
      password: String!
    ):Token
    addAsFriend(
      name: String!
    ):User
  }
`;

const resolvers = {
  Query: {
    personCount: async () => Person.collection.countDocuments(),
    allPersons: async (root, args) => {
      return Person.find({})
    },
    findPerson: async (root, args) => Person.findOne({ name: args.name }),
    me: (root, args, context) => {
      return context.currentUser
    }
  },

  Person: {
    address: (root) => {
      return {
        street: root.street,
        city: root.city,
      };
    },  
  },
  
  Mutation: {
    addPerson: async(root, args, context) => {
      // error handling
      const person = new Person({ ...args })
      const currentUser = context.currentUser
      if(!currentUser){
        throw new AuthenticationError('not AUTHENTICATED')
      }
      try {
        await person.save()
        currentUser.friends.concat(person)
        await currentUser.save()

      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        })
      }
      return person;
    },
    editNumber: async(root, args) => {
      const person = await Person.findOne({ name: args.name})
      person.phone = args.phone

      try {
        await person.save()
      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        })
      }
      return person
    },
    createUser: async(root, args) => {
      const user = new User({ username: args.username})

      return user.save().catch(error => {
        throw new UserInputError(error.message,{
          invalidArgs: args,
        })
      })

    },
    login: async(root, args) => {
      const user = await User.findOne({ username: args.username})
      console.log('happening')
      if (!user || args.password !== 'secret') {
        throw new UserInputError('wrong credentials')
      }

      const userForToken = {
        username : user.username,
        id: user._id,
      }
      return { value: jwt.sign(userForToken, process.env.JWT_KEY)} 
    },
    addAsFriend: async(root, args, { currentUser }) => {
      const isFriend = (person) => currentUser.friends.map(f => f._id.toString())

      if(!currentUser){
        throw new AuthenticationError('not AUTHENTICATED')
      }

      const person = await Person.findOne({ name: args.name })
      if(!isFriend(person)){
        currentUser.friends = currentUser.friends.concat(person)
      }

      await currentUser.save()
      return person;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer')) {
      const decodedToken = jwt.verify(
        auth.substring(7), process.env.JWT_KEY
      )
      const currentUser = await User.findById(decodedToken.id).populate('friends')
      return { currentUser }
    }
  }
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
