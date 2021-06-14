'use strict';

const { error } = require('console');
// server express
const express = require('express');

// morgan, per il logging
const morgan = require('morgan');

// modulo per accedere al db
const dao = require('./dao');

// init express
const app = express();
const port = 3001;

// set up middlewares
app.use(morgan('dev'));

// Attivare il server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

// -*--*--*--*--*- APIs-*--*--*--*--*--*-

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