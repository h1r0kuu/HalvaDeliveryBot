const {Scenes: {WizardScene, Stage}} = require("telegraf")
const replyKeyboard = require("../keyboards/replyKeyboard")
const {Customer, Dish, CartDish} = require("../models/model")
const utils = require("../utils")

const dishName = new WizardScene("choose_dish_by_name", 
    async (ctx) => {
        return ctx.wizard.next()
    },
    
    async (ctx) => {
        try {
            const dish = (ctx.message.text == "⬅️ назад" && typeof ctx.message.text == 'number' ) ? ctx.scene.state.searchQuery : ctx.message.text
            ctx.scene.state.searchQuery = dish
            const dishes = await utils.getDishesByName(dish)
            if(dishes.length > 0) {
                await ctx.reply("Выберите продукт", replyKeyboard.createDishesButtons(dishes))
                return ctx.wizard.next()
            } else {
                await ctx.scene.leave()
                await ctx.reply("Продукты с таким названием не найдены", await replyKeyboard.mainMenu())
                await ctx.scene.enter("choosing_food_scene")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },

    async (ctx) => {
        try {
            const dish = (ctx.message.text == "⬅️ назад") ? ctx.scene.state.dishName : ctx.message.text
            const category = await utils.getDisheByCategory(dish)
            const dishInfo = await Dish.findOne({where: {title: dish, categoryId: category.id}})
            ctx.scene.state.category = category.id
            ctx.scene.state.dishId = dishInfo.id
            ctx.scene.state.dishName = dish
            await ctx.replyWithPhoto(dishInfo.file_id, {caption: `${dishInfo.title}\n\n${dishInfo.description}\n\nЦена: <b>${dishInfo.price} сум</b>`, parse_mode: "HTML"})
            await ctx.reply("Выберите что хотите сделать с продуктом", await replyKeyboard.productOptions())
            return ctx.wizard.next()
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },
    
    async (ctx) => {
        //ctx cursor 3
        const dish = ctx.scene.state
        const dishInfo = await Dish.findOne({where: {title: dish.dishName, categoryId: dish.dishId}})
        const option = ctx.message.text
        if(option == "Изменить фото") {
            await ctx.replyWithPhoto(dishInfo.file_id,{caption: `Отправьте новое фото, текущее фото:`})
            await ctx.wizard.selectStep(4)
        } else if(option == "Изменить состав") {
            await ctx.reply(`Отправьте новый состав, текущий состав:\n<b>${dishInfo.description}</b>`, {parse_mode: "HTML"})
            await ctx.wizard.selectStep(5)
        } else if(option == "Изменить название") {
            await ctx.reply(`Отправьте новое название, текущее название: <b>${dishInfo.title}</b>`, {parse_mode: "HTML"})
            await ctx.wizard.selectStep(6)
        } else if(option == "Изменить цену") {
            await ctx.reply(`Отправьте новую цену, текущая цена: <b>${dishInfo.price}</b>`, {parse_mode: "HTML"})
            await ctx.wizard.selectStep(7)
        } else if(option == "Удалить продукт") {
            await ctx.reply("Вы действительно хотите удалить этот продукт?", await replyKeyboard.confirmDishCreating())
            await ctx.wizard.selectStep(8)
        } else {
            // await ctx.scene.leave()
            await ctx.reply("Неизвестная команда", await replyKeyboard.productOptions())
        }
    },

    async (ctx) => {
        //Photo - 4
        const photo = ctx.message.photo
        if(photo) {
            try {
                const dish = ctx.scene.state
                const dishInfo = await Dish.findOne({where: {title: dish.dishName, categoryId: dish.dishId}})
                let fileId = ''
                if(photo.length > 1) {
                    fileId = photo[0].file_id
                } else {
                    fileId = photo.file_id
                }
                await ctx.scene.leave()
                dishInfo.file_id = fileId
                await dishInfo.save()
                await ctx.reply("Фото успешно изменено!", await replyKeyboard.adminPanel())
            } catch(e) {
                await utils.sendError(ctx, e)
            }
        } else {
            await ctx.reply("Отправьте фото")
        }
    },
    async (ctx) => {
        //Descr - 5
        const description = ctx.message.text
        try {
            const dish = ctx.scene.state
            const dishInfo = await Dish.findOne({where: {title: dish.dishName, categoryId: dish.dishId}})
            if(description.length > 10) {
                await ctx.scene.leave()
                dishInfo.description = description
                await dishInfo.save()
                await ctx.reply("Описание успешно изменено!", await replyKeyboard.adminPanel())
            } else {
                await ctx.reply("Слишком короткий состав")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },
    async (ctx) => {
        //Title - 6
        const title = ctx.message.text
        try {
            const dish = ctx.scene.state
            const dishInfo = await Dish.findOne({where: {title: dish.dishName, categoryId: dish.category}})
            if(title.length > 4) {
                await ctx.scene.leave()
                dishInfo.title = title
                await dishInfo.save()
                await ctx.reply("Название успешно изменено!", await replyKeyboard.adminPanel())
            } else {
                await ctx.reply("Слишком короткое название")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },
    async (ctx) => {
        //Price - 7
        const price = ctx.message.text.replace(" ", "")
        try {
            if(!isNaN(price)) {
                const dish = ctx.scene.state
                const dishInfo = await Dish.findOne({where: {title: dish.dishName, categoryId: dish.category}})
                let priceInt = parseInt(price)
                if(priceInt > 1000) {
                    await ctx.scene.leave()
                    dishInfo.price = priceInt
                    await dishInfo.save()
                    await ctx.reply("Цена успешно изменена!", await replyKeyboard.adminPanel())
                } else {
                    await ctx.reply("Слишком низкая сумма")
                }
            } else {
                await ctx.reply("Введите число")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },

    async (ctx) => {
        //Deleting - 8
        const create = ctx.message.text
        try {
            if(create == "✅ Да") {
                const dish = ctx.scene.state
                const dishInfo = await Dish.findOne({where: {title: dish.dishName, categoryId: dish.category}})
                await dishInfo.destroy()
                
                await CartDish.destroy({where: {dishId: dishInfo.id}, truncate: true})
                
                await ctx.scene.leave()
                await ctx.reply("Продукт успешно удалён!", await replyKeyboard.adminPanel())
            } else if(create == "❌ Нет") {
                await ctx.scene.leave()
                await ctx.reply("Возвращение в админ панель", await replyKeyboard.adminPanel())
            } else {
                await ctx.reply("Нет такого варианта ответа")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }

    }
)

dishName.hears("⬅️ назад", async ctx => {
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

module.exports = dishName