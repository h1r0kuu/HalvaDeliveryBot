const { Op } = require("sequelize");
const {Branch, Category, Dish, Cart, Customer, CartDish, Address, Order, Admins} = require("./models/model")
const replyKeyboard = require("./keyboards/replyKeyboard")
const axios = require("axios")

module.exports = {
    async currTime() {
        let date = new Date()
        return `${date.getFullYear()}-${ ("0" + (date.getMonth() + 1)).slice(-2) }-${date.getDate()} ${date.getHours()}:${("0" + (date.getMinutes() + 1)).slice(-2)}:${("0" + (date.getSeconds() + 1)).slice(-2)}`
    },

    async getBranches() {
        const branches = await Branch.findAll()
        return branches
    },

    async getCategoryByBranch(branch) {
        const branchObj = await Branch.findOne({where: {name: branch}})
        if(branchObj) {
            return {
                branchId: branchObj.id,
                categories: await Category.findAll({where: {branchId: branchObj.id}})
            }
        } else {
            return
        }
    },

    async getDishesByCategory(category) {
        let categoryObj = null
        if(!isNaN(category)) {
            categoryObj = await Category.findByPk(parseInt(category))
        } else {
            categoryObj = await Category.findOne({where: {name: category}})
        }
        if(categoryObj !== null) {
            return {
                categoryId: categoryObj.id,
                title: categoryObj.name,
                dishes: await Dish.findAll({where: {categoryId: categoryObj.id}}) 
            }
        } else {
            return
        }
    },

    async categoryInfo(category) {
        const categoryObj = await Category.findOne({where: {name: category}})
        if(categoryObj !== null) {
            return categoryObj
        } else {
            return false
        }
    },

    async getDisheByCategory(dishName) {
        const category = await Dish.findOne({where: {title: dishName}})
        let catObj = null
        if(category.length > 0) {
            catObj = {
                id: category[0].categoryId,
                name: await Category.findOne({where: {id: category[0].categoryId }})
            }
        } else {
            catObj = {
                id: category.categoryId,
                name: await Category.findOne({where: {id: category.categoryId }})
            }
        }
        return catObj
    },

    async getDishesByName(dishName) {
        const dishes = await Dish.findAll({where: {
            title: {
                [Op.like]: `%${dishName}%`
            }
        }})
        return dishes
    },

    async createOrUpdateCart(user_id, dishId, dishCount) {
        const cart = await Cart.findOne({where: {customerUserId: user_id, status: true}})
        if(cart) {
            const dishInCart = await CartDish.findOne({where: {dishId: dishId, cartId: cart.id}})
            if(dishInCart) {
                dishInCart.amount += dishCount
                await dishInCart.save()
            } else {
                await CartDish.create({
                    dishId: dishId,
                    cartId: cart.id,
                    amount: dishCount
                })
            }
            return cart
        } else {
            const createCart = await Cart.create({
                status: true,
                customerUserId: user_id
            })
            const dish = await CartDish.create({
                dishId: dishId,
                cartId: createCart.id,
                amount: dishCount
            })
            return createCart
        }
    },

    async getCartInfo(user_id) {
        const dishesInCart = await Cart.findOne({where: {customerUserId: user_id, status: true}, include: [
            {model: CartDish, include: [Dish]}
        ]})
        return dishesInCart
    },

    async getCartInfo2(user_id, order_id) {
        const order = await Order.findByPk(order_id)
        const cartId = order.cartId
        const dishesInCart = await Cart.findOne({where: {id: cartId, customerUserId: user_id, status: false}, include: [
            {model: CartDish, include: [Dish]}
        ]})
        return dishesInCart
    },

    async getCartText(dishes) {
        let text = ''
        if(dishes.length > 0) {
            text = '📥 Корзина\n'
            let totalPrice = 0
            dishes.forEach( cartDish => {
                text += `<b>${cartDish.dish.title}</b>\n`
                let price = cartDish.amount * cartDish.dish.price 
                text += `${cartDish.amount} x ${cartDish.dish.price}сум. = <b>${price} сум.</b>\n`
                totalPrice += price
            })
            text += `<b>Итого: ${totalPrice} сум.</b>`
        } else {
            text = "Ваша корзина  пуста"
        }
        return text
    },

    async createOrder(user_id, options) {
        const cart = await Cart.findOne({where: {customerUserId: user_id, status: true}})
        cart.status = false
        await cart.save()
        const order = await Order.create({
            payment_type: options.paymentType,
            comment: options.addInfo,
            address: (options.address) ? options.address : `${options.latitude} ${options.longitude}`,
            extends: options.phoneNumber,
            customerUserId: user_id,
            cartId: cart.id
        })
        return order
    },


    async deleteProductFromCart(product, user_id) {
        const productId = await(await Dish.findOne({where: {title: product.trim()}})).id
        const cartId = await(await Cart.findOne({where: {customerUserId: user_id, status: true}})).id
        await CartDish.destroy({where: {dishId: productId, cartId: cartId}})
    },

    async clearCart(user_id) {
        const cartId = await(await Cart.findOne({where: {customerUserId: user_id, status: true}})).id
        await CartDish.destroy({where: {cartId: cartId}})
    },

    async sendError(ctx, e) {
        console.log(e)
        await ctx.scene.leave()
        await ctx.reply("Что-то пошло не так... Возвращаем вас в главное меню", await replyKeyboard.mainMenu() )
        await ctx.scene.enter("choosing_food_scene")
    },

    async getUserAddress(latitude, longitude) {
        let address = []
        await axios.get(`https://geocode-maps.yandex.ru/1.x?geocode=${longitude}, ${latitude}&apikey=21fe2e03-af7b-40bf-a49c-bc942da712ad&format=json`).then(async res => {
            address.push( res.data.response.GeoObjectCollection.featureMember[0].GeoObject.metaDataProperty.GeocoderMetaData.text )
        })
        return address
    },

    async getAdmins() {
        let admins = []
        let adminList = await Admins.findAll()
        adminList.forEach( async admin => {
           await admins.push(admin.id)
        } )
        return admins
    },

    async userIsAdmin(user_id) {
        const admins = await this.getAdmins()
        for(let i = 0; i < admins.length; i++) {
            if(user_id == admins[i]) {
                return true
            }
        }
        return false
    },

    async getUserIds() {
        const customers = await Customer.findAll()
        const customerIds = []
        customers.forEach( async customer => {
            customerIds.push( customer.user_id )
        })
        return customerIds
    },

    async getOrderInfo(order_id) {
        const order = await Order.findByPk(order_id)
        return order
    },

    async updateDelivery(order_id, deliveryPrice) {
        const order = await Order.findByPk(order_id)
        order.price_delivery = deliveryPrice
        await order.save()
    }

}