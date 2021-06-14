'use strict';

// server express
const express = require('express');

// morgan, per il logging (middleware)
const morgan = require('morgan');

// Validator
const {check, validationResult} = require('express-validator');

// modulo per accedere al db
const dao = require('./dao');

// init express
const app = express();
const port = 3001;

// set up middlewares
app.use(morgan('dev'));
app.use(express.json());

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
    try{
    const courses = await dao.listCourses();
    res.status(200).json(courses);
    } catch (err) {
        res.status(500).end();
    }
});

// GET /api/exams
app.get('/api/exams', async (req, res) => {
    dao.listExams()
        .then((exams) => res.json(exams))
        .catch((err) => res.status(500).json({error: 'Errore DB'}));
});

// GET /api/courses
app.get('/api/courses/:code', async (req, res) => {
    try{
    // ...MANCA VALIDAZIONE...
    const result = await dao.getCourse(req.params.code);
    if (result.error)
        res.status(404).json(result);
    else 
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({error: 'Errore DB'});
    }
});

// POST /api/exams
app.post('/api/exams', [
    check('score').isInt({min: 18, max: 31}), 
    check('code').isLength({min: 7, max: 7}),
    check('date').isDate({format: 'YYYY-MM-DD', strictMode: true})
], (req, res) => {
    
    const errors = validationResult(req);
   
    if (!errors.isEmpty()){
        return res.status(422).json({errors: errors.array()})
    }
    const exam = {
        code: req.body.code,
        score: req.body.score,
        date: req.body.date
    };

    //await dao.createExam(exam);
    //res.status(201).end();

    dao.createExam(exam)
    .then( () => res.status(201).end() )
    .catch( (err) => res.status(500).json({error: 'DB Error'}));
    
});

// http://localhost:3001/api/exams
// {"code": "abc", "date": "2021-05-06", "score": "31"}

// PUT /api/exams
//app.put('', (req, res) => {});

// DELETE /api/exams/:code
//app.delete('/api/exams/:code', (req, res) => {});

// Attivare il server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});