import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
//for Express to get values using the POST method
app.use(express.urlencoded({ extended: true }));
//setting up database connection pool, replace values in red


const pool = mysql.createPool({
    host: "z8dl7f9kwf2g82re.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "t5dx3nanpv72rcef",
    password: "wdaf9hn7sfpiz76m",
    database: "b1pz8uuphb690ey0",
    connectionLimit: 10,
    waitForConnections: true
});

//setting sessions
app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
    //   cookie: { secure: true }
}))


//middleware for whole index.mjs to use
app.use((req, res, next) => {
    res.locals.fullName = req.session.fullName;
    res.locals.admin = req.session.admin;
    console.log(req.url);
    next(); //next middleware/route
});



//routes
app.get('/', async (req, res) => {
    res.render('login.ejs')
});

app.get('/home', isUserAuthenticated, async (req, res) => {
    res.render('home.ejs')
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.post('/loginProcess', async (req, res) => {
    //    let username = req.body.username;
    //    let password = req.body.password;
    let { username, password } = req.body;
    console.log(username + ": " + password);

    let hashedPassword = "";

    let sql = `SELECT *
              FROM admin
              WHERE username = ?`;
    const [rows] = await pool.query(sql, [username]);

    let sql2 = `SELECT *
              FROM usersQuotes
              WHERE username = ?`;
    const [users] = await pool.query(sql2, [username]);

    if (rows.length > 0) { //username was found in the database
        hashedPassword = rows[0].password;
        req.session.admin = true;
    } else if (users.length > 0) {
        hashedPassword = users[0].password;
        req.session.admin = false;
    }

    const match = await bcrypt.compare(password, hashedPassword);

    if (match) {
        req.session.authenticated = true;
        if (req.session.admin) {
            req.session.fullName = rows[0].firstName + " " + rows[0].lastName;
        } else {
            req.session.fullName = users[0].firstName + " " + users[0].lastName;
        }
        res.render('home.ejs', { "fullName": req.session.fullName });
    } else {
        let loginError = "Wrong Credentials! Try again!"
        res.render('login.ejs', { loginError });
    }
});


app.get('/addAuthor', isUserAuthenticated, isUserAdmin, async (req, res) => {
    res.render('addAuthor.ejs')
});


app.post('/addAuthor', async (req, res) => {
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let dob = req.body.dob;
    let bio = req.body.bio;
    let dod = req.body.dod;
    let sex = req.body.sex;
    let imgUrl = req.body.imgUrl;
    let country = req.body.country;
    let profession = req.body.profession;

    let sql = `INSERT INTO authors
               (firstName, lastName, dob, biography, dod, portrait, sex, country, profession)
               VALUES
               (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    let sqlParams = [firstName, lastName, dob, bio, dod, imgUrl, sex, country, profession];
    const [rows] = await pool.query(sql, sqlParams);
    res.redirect('/home')
});

app.get('/addQuote', isUserAuthenticated, isUserAdmin, async (req, res) => {
    let sql = `SELECT authorId, firstName, lastName
               FROM authors`;


    const [authors] = await pool.query(sql);

    let sql2 = `SELECT DISTINCT category
               FROM quotes`;

    const [categories] = await pool.query(sql2);

    res.render('addQuote.ejs', { authors, categories })
});

app.post('/addQuote', async (req, res) => {
    let quote = req.body.quote;
    let category = req.body.category;
    let authorId = req.body.authorId;

    let sql = `INSERT INTO quotes
               (authorId, category, quote)
               VALUES
               (?, ?, ?)`;

    let sqlParams = [authorId, category, quote];
    const [rows] = await pool.query(sql, sqlParams);

    res.redirect('/home')
});

app.get('/authors', isUserAuthenticated, async (req, res) => {
    let sql = `SELECT firstName, lastName, authorId
               FROM authors
               ORDER BY lastName`;

    const [authors] = await pool.query(sql);

    res.render('authors.ejs', { authors })
});

app.get('/quotes', isUserAuthenticated, async (req, res) => {
    let sql = `SELECT quoteId, quote
               FROM quotes
               ORDER BY quote`;

    const [quotes] = await pool.query(sql);

    res.render('quotes.ejs', { quotes })
});

app.get('/updateQuote', isUserAuthenticated, isUserAdmin, async (req, res) => {
    let quoteId = req.query.quoteId;

    let sql = `SELECT *
               FROM quotes
               WHERE quoteId = ?`;

    const [quote] = await pool.query(sql, [quoteId]);

    let sql2 = `SELECT authorId, firstName, lastName
               FROM authors`;


    const [authors] = await pool.query(sql2);

    let sql3 = `SELECT DISTINCT category
               FROM quotes`;

    const [categories] = await pool.query(sql3);


    res.render('updateQuote.ejs', { quote, authors, categories });
});

app.post('/updateQuote', async (req, res) => {
    let quoteId = req.body.quoteId;
    let quote = req.body.quote;
    let category = req.body.category;
    let authorId = req.body.authorId

    let sql = `UPDATE quotes
               SET
               quote = ?,
               category = ?,
               authorId = ?
               WHERE quoteId = ?`;

    let sqlParams = [quote, category, authorId, quoteId];
    const [rows] = await pool.query(sql, sqlParams);

    res.redirect('/quotes');
});

app.get('/deleteQuote', isUserAdmin, async (req, res) => {
    let quoteId = req.query.quoteId;

    let sql = `DELETE
               FROM quotes
               WHERE quoteId = ?`;

    let sqlParams = [quoteId];
    const [quote] = await pool.query(sql, [quoteId]);

    res.redirect('/quotes');
});

app.get('/updateAuthor', isUserAuthenticated, isUserAdmin, async (req, res) => {
    let authorId = req.query.authorId;

    let sql = `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') ISOdob, DATE_FORMAT(dod, '%Y-%m-%d') ISOdod
               FROM authors
               WHERE authorId = ?`;

    let sqlParams = [authorId];
    const [author] = await pool.query(sql, [authorId]);

    res.render('updateAuthor.ejs', { author });
});

app.get('/deleteAuthor', isUserAdmin, async (req, res) => {
    let authorId = req.query.authorId;

    let sql = `DELETE
               FROM authors
               WHERE authorId = ?`;

    let sqlParams = [authorId];
    const [author] = await pool.query(sql, [authorId]);

    res.redirect('/authors');
});

app.post('/updateAuthor', async (req, res) => {
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let dob = req.body.dob;
    let sex = req.body.sex;
    let authorId = req.body.authorId;
    let profession = req.body.profession;
    let country = req.body.country;
    let portrait = req.body.portrait;
    let bio = req.body.bio;

    let sql = `UPDATE authors
               SET
               firstName = ?,
               lastName = ?,
               dob = ?,
               sex = ?,
               profession = ?,
               country = ?,
               portrait = ?,
               biography = ?
               WHERE authorId = ?`;

    let sqlParams = [firstName, lastName, dob, sex, profession, country, portrait, bio, authorId];
    const [rows] = await pool.query(sql, sqlParams);

    res.redirect('/authors');
});

function isUserAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect("/");
    }
}

function isUserAdmin(req, res, next) {
    if (req.session.admin) {
        next();
    } else {
        res.redirect("/home");
    }
}




app.listen(3000, () => {
    console.log("Express server running")
})