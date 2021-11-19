const sequelize = require("./db_conf")
const {DataTypes} = require("sequelize")

const Customer = sequelize.define("customer", {
    //Структура данных Пользователя
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        primaryKey: true
    }

})

const Branch = sequelize.define("branch", {
    //Структура данных Филиалов
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    
    name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true
    }
})

const Category = sequelize.define("category", {
    //Структура данных Категорий
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    
    name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true
    }
})

const Dish = sequelize.define("dish", {
    //Структура данных Страв
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    title: {
        type: DataTypes.STRING(150)
    },

    description: {
        type: DataTypes.TEXT,
    },

    file_id: {
        type: DataTypes.STRING,
    },

    price: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
})

const Cart = sequelize.define("cart", {
    //Структура данных Корзины
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
})

const CartDish = sequelize.define("cart_dish", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    amount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
})

const Order = sequelize.define("order", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    payment_type: {
        type: DataTypes.STRING,
    },
    
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },

    comment: {
        type: DataTypes.STRING,
        defaultValue: "ok"
    },

    address: {
        type: DataTypes.STRING,
    },

    price_delivery: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },

    extend: {
        type: DataTypes.STRING(50),
    }
})

const Address = sequelize.define("address", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    address: {
        type: DataTypes.STRING(300),
    },

    address_name: {
        type: DataTypes.STRING(500)
    }
})

const Admins = sequelize.define("admins", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    }
})

Branch.hasMany(Category)
Category.belongsTo(Branch)

Category.hasMany(Dish)
Dish.belongsTo(Category)

Customer.hasOne(Cart)
Cart.belongsTo(Customer)

CartDish.belongsTo(Dish)

Cart.hasMany(CartDish)
CartDish.belongsTo(Cart)

Customer.hasMany(Order)

Order.belongsTo(Cart)

Customer.hasMany(Address)

module.exports = {
    Customer,
    Branch,
    Category,
    Dish,
    Cart,
    CartDish,
    Order,
    Address,
    Admins
}