const {Telegraf, Scenes: {WizardScene, Stage}} = require("telegraf")
const replyKeyboard = require("../keyboards/replyKeyboard")
const {Customer, Dish} = require("../models/model")
const utils = require("../utils")

const createDish = new WizardScene("create_dish_scene",
    async ctx => {
        return ctx.wizard.next()
    },
    async ctx => {
        const categoryText = (ctx.message.text == "⬅️ назад") ? ctx.scene.state.categoryText : ctx.message.text
        try {
            const category = await utils.categoryInfo(categoryText)
            if(category !== false) {
                ctx.scene.state.categoryId = category.id
                ctx.scene.state.categoryText = categoryText
                await ctx.reply("Введите название продукта")
                return ctx.wizard.next()
            } else {
                await ctx.reply("Категория не найдена")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },
    async ctx => {
        const title = (ctx.message.text == "⬅️ назад") ? ctx.scene.state.title : ctx.message.text
        try {
            if(title.length > 4) {
                ctx.scene.state.title = title
                await ctx.reply("Введите соства продукта")
                return ctx.wizard.next()
            } else {
                await ctx.reply("Слишком короткое название")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },
    async ctx => {
        const description = (ctx.message.text == "⬅️ назад") ? ctx.scene.state.description : ctx.message.text
        try {
            if(description.length > 10) {
                ctx.scene.state.description = description
                await ctx.reply("Введите цену продукта")
                return ctx.wizard.next()
            } else {
                await ctx.reply("Слишком короткий состав")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },
    async ctx => {
        const price = (ctx.message.text == "⬅️ назад") ? ctx.scene.state.price : ctx.message.text.replace(" ", "")
        try {
            if(!isNaN(price)) {
                ctx.scene.state.price = price
                await ctx.reply("Отправьте фото продукта")
                return ctx.wizard.next()
            } else {
                await ctx.reply("Введите число")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },
    async ctx => {
        const photo = ctx.message.photo
        try {
            if(photo) {
                let fileId = ''
                if(photo.length > 1) {
                    fileId = photo[0].file_id
                } else {
                    fileId = photo.file_id
                }
                ctx.scene.state.fileId = fileId
                const dishInfo = ctx.scene.state
                await ctx.replyWithPhoto(fileId, {caption: `Категория продукта: <b>${dishInfo.categoryText}</b>\nНазвание продукта: <b>${dishInfo.title}</b>\nСостав продукта: <b>${dishInfo.description}</b>\nЦена продукта: <b>${dishInfo.price} сум</b>`, parse_mode: "HTML"})
                await ctx.reply("Создать продукт?", await replyKeyboard.confirmDishCreating())
                return ctx.wizard.next()
            } else {
                await ctx.reply("Отправьте фото")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },

    async ctx => {
        const create = ctx.message.text
        try {
            if(create == "✅ Да") {
                const dishInfo = ctx.scene.state
                await ctx.scene.leave()
                await Dish.create({
                    title: dishInfo.title,
                    description: dishInfo.description,
                    file_id: dishInfo.fileId,
                    price: dishInfo.price,
                    categoryId: dishInfo.categoryId
                })
                await ctx.reply("Вы успешно создали продукт", await replyKeyboard.adminPanel())
            } else if(create == "❌ Нет") {
                await ctx.scene.leave()
                await ctx.reply("Вы отменили создание продукта", await replyKeyboard.adminPanel())
            } else {
                await ctx.reply("Нет такого варианта ответа")
            }
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    }
    
)

createDish.hears("⬅️ назад", async ctx => {
    ctx.wizard.cursor -= 2;
    if (ctx.wizard.cursor < 0) {
        ctx.reply("Возвращаем вас в админ панель", await replyKeyboard.adminPanel())
        ctx.wizard.cursor = 0
        return ctx.scene.leave()
    } else if(ctx.wizard.cursor == 0) {
        ctx.reply("Возвращаем вас в админ панель", await replyKeyboard.adminPanel())
        return ctx.scene.leave()
    }
    ctx.wizard.selectStep(ctx.wizard.cursor)
    return ctx.wizard.steps[ctx.wizard.cursor](ctx)
})

module.exports = createDish