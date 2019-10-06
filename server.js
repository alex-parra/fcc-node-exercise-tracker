const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const shortid = require('shortid');

const cors = require("cors");

const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost/exercise-track");

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});


const models = {};

models.User = mongoose.model('User', new mongoose.Schema({
  _id: { type: String, default: shortid.generate },
  username: String,
  exercises: [String],
}));

models.Exercise = mongoose.model('Exercise', new mongoose.Schema({
  _id: { type: String, default: shortid.generate },
  userId: String,
  description: String,
  duration: Number,
  date: Date,
}));


app.get('/api/exercise/users', (req, res) => {
  models.User.find({}, 'username', (err, users) => {
    if( err ) return res.status(500).json({error: err});
    
    return res.json( users.map(u => ({_id: u.id, username: u.username, exercises: u.exercises})) );
  });
});


app.post('/api/exercise/new-user', (req, res) => {
  const {username} = req.body;
  if( !username ) return res.status(400).json({error: 'Username is required.'});
  
  const newUser = new models.User({username});
  newUser.save((err, user) => {
    if( err ) return res.status(500).json({error: err});
    
    const { _id, username } = user;
    return res.json({_id, username});
  });
});


app.post('/api/exercise/add', (req, res) => {
  const { userId, description, duration } = req.body;
  if( !userId || !description || !duration ) return res.status(400).json({error: 'Invalid input.'});
  
  const date = req.body.date ? new Date(req.body.date) : new Date();
  
  models.User.findById(userId, (err, user) => {
    if( err ) return res.status(404).json({error: 'User not found.'});
    
    const newExercise = new models.Exercise({userId: user, description, duration, date});
    newExercise.save((err, exercise) => {
      if( err ) return res.status(500).json({error: err});
      
      models.User.populate(user, {path: 'exercises'}, (err, user) => {
        return res.json({user}); 
      });
    });
  });
  
});


app.get('/api/exercise/log', (req, res) => {
  const { userId, from, to, limit = 10 } = req.query;
  const filters = { userId };

  if( from || to ) {
    filters.date = {};
    if( from ) filters.date.$gte = new Date(from);
    if( to ) filters.date.$lte = new Date(to);
  }
  
  models.Exercise.find(filters).limit(Number(limit)).exec((err, exercises) => {
    models.User.findById(userId, (err, user) => {
      const { _id, username } = user;
      const data = Object.assign({}, {_id, username, exercises, count: exercises.length});
      return res.json(data);
    });
  });
});



// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
