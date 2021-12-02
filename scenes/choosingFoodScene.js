const {Scenes: {WizardScene, Stage}} = require("telegraf")
const replyKeyboard = require("../keyboards/replyKeyboard")
const { Dish, Cart, CartDish, Customer, Category } = require("../models/model")
const utils = require("../utils")

const choosingFoodScene = new WizardScene("choosing_food_scene",
    async (ctx) => {
        return ctx.wizard.next()
    },
    async (ctx) => {
        try {
            const branch = (ctx.message.text == "⬅️ назад") ? ctx.scene.state.branchText : ctx.message.text 
            const catObj = await utils.getCategoryByBranch(branch)
            if(catObj !== undefined) {
                const categories = catObj.categories
                if(categories.length > 0) {
                    ctx.scene.state.branch = catObj.branchId
                    ctx.scene.state.branchText = branch
                    await ctx.reply("Отлично! Выберите категорию", replyKeyboard.createCategoryButtons(categories) )
                    return ctx.wizard.next()
                } else {
                    await ctx.scene.leave()
                    await ctx.reply("У этого филлиала пока-что нету категорий", await replyKeyboard.mainMenu())
                    return ctx.scene.enter("choosing_food_scene")
                }
            } else {
                await ctx.scene.leave()
                await ctx.reply("Филлиал не найден", await replyKeyboard.mainMenu())
                return ctx.scene.enter("choosing_food_scene")
            }

        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },

    async (ctx) => {
        try {
            const category = (ctx.message.text == "⬅️ назад" || ctx.message.text == ctx.scene.state.dishCount) ? ctx.scene.state.categoryText : ctx.message.text
            const dishObj = await utils.getDishesByCategory(category)
            if(dishObj !== undefined) {
                const dishes = dishObj.dishes
                if(dishes.length > 0) {
                    ctx.scene.state.category = dishObj.categoryId
                    ctx.scene.state.categoryText = category
                    await ctx.reply("Выберите продукт", replyKeyboard.createDishesButtons(dishes) )
                    return ctx.wizard.next()
                } else {
                    await ctx.scene.leave()
                    await ctx.reply("У этой категории пока-что нету продуктов", await replyKeyboard.mainMenu())
                    return ctx.scene.enter("choosing_food_scene")
                }
            } else {
                await ctx.scene.leave()
                await ctx.reply("Такой категории нету", await replyKeyboard.mainMenu())
                return ctx.scene.enter("choosing_food_scene")
                
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },

    async (ctx) => {
        try {
            const dish = (ctx.message.text == "⬅️ назад") ? ctx.scene.state.dishText : ctx.message.text
            const data = ctx.scene.state
            const dishInfo = await Dish.findOne({where: {title: dish, categoryId: data.category}})
            ctx.scene.state.dishId = dishInfo.id
            ctx.scene.state.dishText = dish
            await ctx.replyWithPhoto(dishInfo.file_id, {caption: `${dishInfo.title}\n\n${dishInfo.description}\n\nЦена: <b>${dishInfo.price} сум</b>`, parse_mode: "HTML"})
            await ctx.reply("Выберите колличество или введите", replyKeyboard.dishCount())
            return ctx.wizard.next()
        } catch(e) {
            await utils.sendError(ctx, e)
        }

    },

    async (ctx) => {
        const dishCount = ctx.message.text
        if(!isNaN(dishCount)) {
            try {
                await ctx.reply("Ваш заказ добавлен в корзину!")//ДОБАВИТЬ КНОПКИ 
                const dishObj = await utils.getDishesByCategory( ctx.scene.state.category )
                ctx.scene.state.dishCount = ctx.message.text
                // await ctx.reply( "Выберите продукт", replyKeyboard.createDishesButtons(dishObj.dishes) )
                let res = await Customer.findOne({where: {user_id: ctx.message.from.id}})
                if(res === null) {
                    await Customer.create({
                        user_id: ctx.message.from.id
                    })
                }
                await utils.createOrUpdateCart(parseInt(ctx.message.from.id), parseInt(ctx.scene.state.dishId), parseInt(dishCount))
                ctx.wizard.cursor -= 2;
                ctx.wizard.selectStep(ctx.wizard.cursor);
                return ctx.wizard.steps[ctx.wizard.cursor](ctx);
            } catch(e) {
                await utils.sendError(ctx, e)
            }
        } else {
            await ctx.reply("Введите число")
        }
    },

    async (ctx) => {
        const msg = ctx.message.text
        try {
            if(msg.startsWith("❌")) {
                const product = msg.split(" ")[1]
                await utils.deleteProductFromCart(product, ctx.message.from.id)
    
                let cart = await utils.getCartInfo(ctx.message.from.id)
        
                if(cart !== null) {
                    let cartDishes = cart.cart_dishes
                    const text = await utils.getCartText(cartDishes)
                    if(cartDishes.length > 0) {
                        context = replyKeyboard.keyboardForCart(cartDishes)
                        context.parse_mode = "HTML"
                        await ctx.reply(text, context)
                    } else {
                        await ctx.scene.leave()
                        await ctx.reply("ℹОтлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu())
                        return ctx.scene.enter("choosing_food_scene")
                    }
                } else {
                    await ctx.scene.leave()
                    await ctx.reply("Ваша корзина пуста", await replyKeyboard.mainMenu())
                    return ctx.scene.enter("choosing_food_scene")
                }
            } else if(msg == "🔄 Очистить") {
                await ctx.scene.leave()
                await utils.clearCart(ctx.message.from.id)
                await ctx.reply("ℹОтлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu())
                await ctx.scene.enter("choosing_food_scene")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    }
)

choosingFoodScene.hears("⬅️ назад", async ctx => {
    ctx.wizard.cursor -= 2;
    if (ctx.wizard.cursor < 0) {
        ctx.reply("ℹОтлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu())
        ctx.wizard.cursor = 0
    } else if(ctx.wizard.cursor == 0) {
        ctx.reply("ℹОтлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu())
    }
    ctx.wizard.selectStep(ctx.wizard.cursor)
    return ctx.wizard.steps[ctx.wizard.cursor](ctx)
})

choosingFoodScene.hears("📥 Корзина", async ctx => {
    const stepBeforeCart = ctx.wizard.cursor
    
    if(stepBeforeCart !== 0) {
        try {
            let cart = await utils.getCartInfo(ctx.message.from.id)
            if(cart !== null) {
                let cartDishes = cart.cart_dishes
                const text = await utils.getCartText(cartDishes)
                if(cartDishes.length > 0) {
                    context = replyKeyboard.keyboardForCart(cartDishes)
                    context.parse_mode = "HTML"
                    await ctx.reply(text, context)
                } else {
                    // await ctx.scene.leave()
                    await ctx.reply(text, await replyKeyboard.mainMenu())
                    return ctx.wizard.selectStep(1)
                }
            } else {
                // await ctx.scene.leave()
                await ctx.reply("Ваша корзина пуста", await replyKeyboard.mainMenu())
                return ctx.wizard.selectStep(1)
            }
            
            await ctx.wizard.selectStep(5)
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    }
})

module.exports = choosingFoodScene