// index.js - Fixed version
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const session = require("express-session");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: "secret", resave: false, saveUninitialized: true }));

app.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});

// if product is in the  cart or not
function isProductInCart(cart, id) {
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].id == id) {
      return true;
    }
  }
  return false;
}

// total of all items in cart as per quantity

function calculateTotal(cart, req) {
  let total = 0;
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].sale_price) {
      total += cart[i].sale_price * cart[i].quantity;
    } else {
      total += cart[i].price * cart[i].quantity;
    }
  }
  req.session.total = total;
  return total;
}

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "node_project",
};

app.get("/", (req, res) => {
  //get data from mysql (XAMPP DB)
  const con = mysql.createConnection(dbConfig); // creating connection
  //query to select products from resp DB
  con.query("SELECT * FROM products", (err, result) => {
    if (err) throw err;
    res.render("pages/index", { result: result });
    // renders the "result" to show
    // the result on template ejs on line 392 of index.ejs (result.forEach)
  });
});
//  add to cart , checks if products are there or not, if not then adds
app.post("/add_to_cart", (req, res) => {
  const id = req.body.id;
  const con = mysql.createConnection(dbConfig);

  con.query("SELECT * FROM products WHERE id = ?", [id], (err, result) =>
    ////This runs a SQL query to find the product with the given id from your products table.
    //The ? is a placeholder for the value in [id] — this helps prevent SQL injection (good practice).
    //result is an array containing the product(s) returned from the database.

    {
      if (err) return res.status(500).send("Database error");
      // if prod in cart ,make quantity 1
      if (result.length > 0) {
        const product = result[0]; //product 1 exists
        product.quantity = 1; //+ quantity by 1
        // if product not in cart , add it
        if (!req.session.cart) req.session.cart = [];

        const cart = req.session.cart;
        let found = false;
        // looping through all products
        for (let i = 0; i < cart.length; i++) {
          if (cart[i].id == product.id) {
            cart[i].quantity += 1;
            found = true;
          }
        }

        if (!found) cart.push(product);

        calculateTotal(cart, req);
        res.redirect("/cart");
      } else {
        res.send("Product not found");
      }
    }
  );
});

app.get("/cart", (req, res) => {
  const cart = req.session.cart || [];
  const total = req.session.total || 0;
  res.render("pages/cart", { cart: cart, total: total }); //ejs use
  //  <% if (Array.isArray(cart)) { %> <% cart.forEach(function(item) { %> line 171 cart.ejs
});

// remove product

app.post("/remove_product", (req, res) => {
  const id = req.body.id;
  const cart = req.session.cart;

  for (let i = 0; i < cart.length; i++) {
    if (cart[i].id == id) {
      cart.splice(i, 1);
      break;
    }
  }

  calculateTotal(cart, req);
  res.redirect("/cart");
});

//edit quantity

app.post("/edit_product_quantity", (req, res) => {
  const id = req.body.id;
  const increase = req.body.increase_product_quantity;
  const decrease = req.body.decrease_product_quantity;
  const cart = req.session.cart;

  if (increase) {
    for (let i = 0; i < cart.length; i++)
      if (cart[i].id == id) {
        if (cart[i].quantity > 0) {
          cart[i].quantity = parseInt(cart[i].quantity + 1);
        }
      }
  }
  if (decrease) {
    for (let i = 0; i < cart.length; i++)
      if (cart[i].id == id) {
        if (cart[i].quantity > 0) {
          cart[i].quantity = parseInt(cart[i].quantity - 1);
        }
      }
  }
  //     if (decrease && cart[i].quantity > 1) cart[i].quantity -= 1;
  //   }
  // }

  calculateTotal(cart, req);
  res.redirect("/cart");
});

//
app.get("/about", (req, res) => {
  res.render("pages/about");
});

//checkout get query express
// app.get("/checkout", function (req, res) {
//   res.render("pages/checkout");
// });

app.get("/checkout", function (req, res) {
  const cart = req.session.cart || [];
  const total = req.session.total || 0;

  res.render("pages/checkout", { cart: cart, total: total });
});

//after placing order and checking out
app.post("/place_order", function (req, res) {
  const name = req.body.name;
  const email = req.body.email;
  const phone = req.body.phone;
  const city = req.body.city;
  const address = req.body.address;
  const cost = req.body.total;
  const status = "not paid";
  const date = new Date();
  var products_ids = "";
  var id = Date.now();
  req.session.order_id = id;

  const con = mysql.createConnection(dbConfig); // <-- use global dbConfig here

  var cart = req.session.cart;
  for (let i = 0; i < cart.length; i++) {
    products_ids = products_ids + "," + cart[i].id;
  }
  con.connect((err) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database connection error");
    } else {
      const query =
        "INSERT INTO orders(id,cost, name, email, status, city, address, phone, date, products_ids) VALUES ?";
      const values = [
        [
          id,
          cost,
          name,
          email,
          status,
          city,
          address,
          phone,
          date,
          products_ids,
        ],
      ];

      con.query(query, [values], (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Database insertion error");
        } else {
          res.redirect("/payment");
        }
      });
    }
  });
});

app.get("/payment", function (req, res) {
  var total = req.session.total;
  res.render("pages/payment", { total: total });
});

const con = mysql.createConnection(dbConfig); // <-- use global dbConfig here

app.get("/verify_payment", function (req, res) {
  var transaction_id = req.query.transaction_id;
  var order_id = req.session.order_id;

  con.connect((err) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Database connection error");
    } else {
      const query =
        "INSERT INTO payments(order_id,transaction_id, date) VALUES ?";
      const values = [[order_id, transaction_id, new Date()]];

      con.query(query, [values], (err, result) => {
        con.query(
          "UPDATE orders SET status='paid' WHERE id='" + order_id + "'",
          (err, result) => {}
        );

        res.redirect("/thank_you");
      });
    }
  });
});

app.get("/single_product", function (req, res) {
  const id = req.query.id;

  const con = mysql.createConnection(dbConfig);
  con.query("SELECT * FROM products WHERE id = ?", [id], (err, result) => {
    if (err) throw err;
    res.render("pages/single_product", { result:result});
  });
});




app.get("/products", function (req, res) {
  const con = mysql.createConnection(dbConfig);

  con.query("SELECT * FROM products", (err, result) => {
    if (err) throw err;
    res.render("pages/products", { result: result });
  }); 
}); 
app.get("/about", function (req, res) {
  
});


