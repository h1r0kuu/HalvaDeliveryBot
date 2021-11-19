const {Telegraf, Scenes: {WizardScene, Stage}} = require("telegraf")
const replyKeyboard = require("../keyboards/replyKeyboard")
const {Customer, Dish, CartDish} = require("../models/model")
const utils = require("../utils")

const reviewScene = new WizardScene("delete_category_scene",
    async ctx => {
       return ctx.wizard.next()
    },

    async ctx => {
        const categoryText = ctx.message.text
        const category = await utils.categoryInfo(categoryText)
        if(category !== false) {
            ctx.scene.state.categoryText = categoryText
            await ctx.reply("Вы действительно хотите удалить эту категорию?\nВНИМАНИЕ!: Вместе с категорией удалятся продукты которые принадлежат этой категории", await replyKeyboard.confirmDishCreating())
            return ctx.wizard.next()
        } else {
            await ctx.reply("Такой категории не существует")
        }
    },
    async ctx => {
        const create = ctx.message.text
        try {
            if(create == "✅ Да") {
                const category = await utils.categoryInfo(ctx.scene.state.categoryText)
                const dishesToDelete = await Dish.findAll({where: {categoryId: category.id}})
                let dishIds = []
                dishesToDelete.forEach( async dish => {
                    dishIds.push(dish.id)
                })
                await category.destroy()
                await CartDish.destroy({where: {dishId: dishIds}, truncate: true})
                await ctx.reply("Вы усешно удалили категорию", await replyKeyboard.adminPanel())
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