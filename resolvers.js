
const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()
const { UserInputError, AuthenticationError } = require('@apollo/server')
const jwt = require('jsonwebtoken')
const Person = require('./models/person')
const User = require('./models/user')

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

        pubsub.publish('PERSON_ADDED', {personAdded: person})
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

    Subscription: {
        personAdded:{
            subscribe: () => pubsub.asyncIterator('PERSON_ADDED')
        }
    }
  };

  module.exports = resolvers