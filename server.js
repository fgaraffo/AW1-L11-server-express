'use strict';

// server express
const express = require('express');

// dayjs
const dayjs = require('dayjs');

// morgan, per il logging (middleware)
const morgan = require('morgan');

// Validator
const { check, validationResult } = require('express-validator');

// modulo per accedere al db
const examDao = require('./exam-dao');

// Autenticazione
const passport = require('passport'); // auth middleware
const LocalStrategy = require('passport-local').Strategy; // username and password for login
const session = require('express-session'); // enable sessions
const userDao = require('./user-dao'); // module for accessing the users in the DB

/*** Set up Passport ***/
// set up the "username and password" login strategy
// by setting a function to verify username and password
passport.use(new LocalStrategy(
    function(username, password, done) {
      userDao.getUser(username, password).then((user) => {
        if (!user)
          return done(null, false, { message: 'Incorrect username and/or password.' });
          
        return done(null, user);
      })
    }
  ));

  // serialize and de-serialize the user (user object <-> session)
// we serialize the user id and we store it in the session: the session is very small in this way
passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  // starting from the data in the session, we extract the current (logged-in) user
  passport.deserializeUser((id, done) => {
    userDao.getUserById(id)
      .then(user => {
        done(null, user); // this will be available in req.user
      }).catch(err => {
        done(err, null);
      });
  });

// init express
const app = express();
const port = 3001;

// set up middlewares
app.use(morgan('dev'));
app.use(express.json());

// custom middleware: check if a given request is coming from an authenticated user
const isLoggedIn = (req, res, next) => {
    if(req.isAuthenticated())
      return next();
    
    return res.status(401).json({ error: 'not authenticated'});
  }
  
  // set up the session
  app.use(session({
    // by default, Passport uses a MemoryStore to keep track of the sessions
    secret: 'a secret sentence not to share with anybody and anywhere, used to sign the session ID cookie',
    resave: false,
    saveUninitialized: false 
  }));

  // then, init passport
app.use(passport.initialize());
app.use(passport.session());

// -*--*--*--*--*- APIs-*--*--*--*--*--*-

/* APIs per applicazione react-scores
/*
# GET /api/courses
# GET /api/courses/:code
# GET /api/exams
 POST /api/exams            --> riceverà l'esame nel body
 PUT /api/exams             --> di solito restituisce l'oggetto modificato
                                esempio: ricevo {code: , date: , score: } e restituisco {id: , code: , date: , score: }
 DELETE /api/exams/:code
*/

// GET /api/courses
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await examDao.listCourses();
        res.status(200).json(courses);
        //setTimeout(()=>res.status(200).json(courses), 2000);
    } catch (err) {
        res.status(500).json({ error: 'Errore DB' });
    }
});

// GET /api/exams
app.get('/api/exams', isLoggedIn, async (req, res) => {
    examDao.listExams(req.user.id)
        .then((exams) => res.json(exams))
        .catch((err) => res.status(500).json({ error: 'Errore DB' }));
});

// GET /api/courses/:code
app.get('/api/courses/:code', [check('code').isLength({ min: 7, max: 7 }).matches(/\d\d[A-Z]{5}/)], async (req, res) => {
    try {
        // VALIDAZIONE
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        // QUERY DB
        const result = await examDao.getCourse(req.params.code);
        if (result.error)
            res.status(404).json(result); // cerca ma riceve stringa vuota, restituisce oggetto {error: ...}
        else
            res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ error: 'Errore DB' });
    }
});

// POST /api/exams
app.post('/api/exams', isLoggedIn, [
    check('score').isInt({ min: 18, max: 31 }),
    check('code').isLength({ min: 7, max: 7 }),
    check('date').isDate({ format: 'YYYY-MM-DD', strictMode: true })
], (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() })
    }

    const date = dayjs(req.body.date);

    if (!date.isBefore())
        return res.status(422).json({ error: `La data ${date.format('DD/MM/YYYY')} non è valida.` });

    const exam = {
        code: req.body.code,
        score: req.body.score,
        date: req.body.date
    };

    //await dao.createExam(exam);
    //res.status(201).end();

    examDao.createExam(exam, req.user.id)
        .then(() => res.status(201).end())
        .catch((err) => res.status(503).json({ error: `DB Error during the creation of exam ${exam.code}` }));
        //.then(() => setTimeout(() => res.status(201).end(), 2000))
});

// PUT /api/exams
app.put('/api/exams', isLoggedIn, [
    check('score').isInt({ min: 18, max: 31 }),
    check('code').isLength({ min: 7, max: 7 }),
    check('date').isDate({ format: 'YYYY-MM-DD', strictMode: true })
], (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() })
    }

    const exam = {
        code: req.body.code,
        score: req.body.score,
        date: req.body.date
    };

    const date = dayjs(req.body.date);

    if (!date.isBefore())
        return res.status(422).json({ error: `La data ${date.format('DD/MM/YYYY')} non è valida.` });

    examDao.updateExam(exam, req.user.id)
        .then((id) => res.status(200).json({ ID: id, message: `Exam ${req.body.code} updated.` }))
        .catch((err) => res.status(503).json({ error: `DB Error during the update of exam ${exam.code}` }))
        //.then((id) => setTimeout(res.status(200).json({ ID: id, message: `Exam ${req.body.code} updated.` }), 2000))

});

// DELETE /api/exams/:code
app.delete('/api/exams/:code', isLoggedIn, [
    check('code').isLength({ min: 7, max: 7 }).matches(/\d\d[A-Z]{5}/)],
    (req, res) => {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        examDao.deleteExam(req.params.code, req.user.id)
            .then(() => res.status(204).json({ message: `Exam ${req.params.code} deleted.` }))
            .catch((err) => res.status(503).json({ error: 'DB error' }));
            //.then(() => setTimeout(res.status(204).json({ message: `Exam ${req.params.code} deleted.` }), 2000))
    });

    /*** Users APIs ***/

// POST /sessions 
// login
app.post('/api/sessions', function(req, res, next) {
    passport.authenticate('local', (err, user, info) => {
      if (err)
        return next(err);
        if (!user) {
          // display wrong login messages
          return res.status(401).json(info);
        }
        // success, perform the login
        req.login(user, (err) => {
          if (err)
            return next(err);
          
          // req.user contains the authenticated user, we send all the user info back
          // this is coming from userDao.getUser()
          return res.json(req.user);
        });
    })(req, res, next);
  });

  // DELETE /sessions/current 
// logout
app.delete('/api/sessions/current', (req, res) => {
    req.logout();
    res.end();
  });
  
  // GET /sessions/current
  // check whether the user is logged in or not
  app.get('/api/sessions/current', (req, res) => {
    if(req.isAuthenticated()) {
      res.status(200).json(req.user);}
    else
      res.status(401).json({error: 'Unauthenticated user!'});;
  });

// Attivare il server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

/* ----------------- FINE ---------------*/

// STRINGA PROVA
// http://localhost:3001/api/exams
// {"code": "abc", "date": "2021-05-06", "score": "31"}