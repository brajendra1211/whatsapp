const express = require("express");
const { signup, login } = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

router.get("/test",(req,res)=>{
 res.send("Auth working");
});

module.exports = router;