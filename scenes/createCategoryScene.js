const {Telegraf, Scenes: {WizardScene, Stage}} = require("telegraf")
const replyKeyboard = require("../keyboards/replyKeyboard")
const {Customer, Dish, CartDish, Category} = require("../models/model")
const utils = require("../utils")

const reviewScene = new WizardScene("create_category_scene",
    async ctx => {
       return ctx.wizard.next()
    },

    async ctx => {
        const categoryText = ctx.message.text
        if(categoryText != "❌ Отмена") {
            try {
                const category = await utils.categoryInfo(categoryText)
                if(category === false) {
                    if(categoryText.length > 3) {
                        ctx.scene.state.categoryText = categoryText
                        await ctx.reply("Создать категорию с названием " + categoryText, await replyKeyboard.confirmDishCreating())
                        return ctx.wizard.next()
                    } else {
                        await ctx.reply("Слишком короткое название")
                    }
                } else {
                    await ctx.reply("Категория с таким названием уже существует")
                }
            } catch(e) {
                await utils.sendError(ctx, e)
            }
        } else {
            await ctx.reply("Возвращаем вас в админ панель", await replyKeyboard.adminPanel())
            await ctx.scene.leave()
        }

    },
    async ctx => {
        const create = ctx.message.text
        try {
            if(create == "✅ Да") {
                await Category.create({
                    name: ctx.scene.state.categoryText,
                    branchId: 1
                })
                await ctx.reply("Вы усешно создали категорию", await replyKeyboard.adminPanel())
                await ctx.scene.leave()
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

module.exports = reviewScene