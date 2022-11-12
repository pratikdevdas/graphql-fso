require('dotenv').config()
const { ApolloServer, gql, UserInputError } = require("apollo-server");
const { v1: uuid } = require("uuid");
const mongoose = require('mongoose')
const Person = require('./models/person')

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
  }
`;

const resolvers = {
  Query: {
    personCount: async () => Person.collection.countDocuments(),
    allPersons: async (root, args) => {
      return Person.find({})
    },
    findPerson: async (root, args) => Person.findOne({ name: args.name }),
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
    addPerson: async(root, args) => {
      // error handling
      const person = new Person({ ...args })
      try {
        await person.save()
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
    }
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
