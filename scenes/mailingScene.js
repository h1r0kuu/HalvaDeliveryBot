require("dotenv").config()
const {Scenes: {WizardScene, Stage}} = require("telegraf")
const replyKeyboard = require("../keyboards/replyKeyboard")
const {Customer, Dish} = require("../models/model")
const utils = require("../utils")

const mailingScene = new WizardScene("mailing_scene", 
    async (ctx) => {
        return ctx.wizard.next()
    },

    async (ctx) => {
        const mailType = (ctx.message.text == "⬅️ назад") ? ctx.scene.state.mailType : ctx.message.text
        if(mailType == "Рассылка продукта") {
            ctx.scene.state.mailType = mailType
            await ctx.reply("Введите название продукта")
            return ctx.wizard.selectStep(4)
        } else if(mailType == "Обычная рассылка") {
            ctx.scene.state.mailType = mailType
            await ctx.reply("Введите текст рассылки", await replyKeyboard.back())
            return ctx.wizard.next()
        } else {
            await ctx.reply("Такой рассылки нету")
        }
    },

    async (ctx) => {
        const mailText = (ctx.message.text == "⬅️ назад") ? ctx.scene.state.mailingText : ctx.message.text
        if(mailText.length > 5) {
            ctx.scene.state.mailingText = mailText
            await ctx.reply("Отправьте фото/видео или напишите \"Пусто\"", await replyKeyboard.back)
            return ctx.wizard.next()
        } else {
            await ctx.reply("Слишком короткое сообщение для рассылки")
        }
    },

    async (ctx) => {
        const type = ctx.message
        const data = ctx.scene.state
        const userIds = await utils.getUserIds()

        

        let keyboardExist = (typeof keyboard !== 'undefined') ? true : false
        let count = 0
        try {
            if(ctx.message.text && ctx.message.text == "Пусто") {
                const userIds = await utils.getUserIds()
                let contextToSend = {}
                if(data.searchQuery) {
                    contextToSend = await replyKeyboard.productBtn(data.dishName, data.dishId, data.category)
                }
                contextToSend.caption = ctx.scene.state.mailingText
                userIds.forEach( user_id => {
                    ctx.telegram.sendPhoto(user_id, file_id, contextToSend)
                    count += 1
                })
            } else {
    
                if(type.photo) {
                    let file_id = (type.photo.length > 1) ? type.photo[0].file_id : type.photo.file_id
                    ctx.scene.state.photoId = file_id
                    let contextToSend = {}
                    if(data.searchQuery) {
                        contextToSend = await replyKeyboard.productBtn(data.dishName, data.dishId, data.category)
                    }
                    contextToSend.caption = ctx.scene.state.mailingText
                    userIds.forEach( user_id => {
                        ctx.telegram.sendPhoto(user_id, file_id, contextToSend)
                        count += 1
                    })
                } else if(type.video) {
                    const userIds = await utils.getUserIds()
                    let file_id = type.video.file_id
                    ctx.scene.state.videoId = file_id
                    let contextToSend = {}
                    if(data.searchQuery) {
                        contextToSend = await replyKeyboard.productBtn(data.dishName, data.dishId, data.category)
                    }       
                    contextToSend.caption = ctx.scene.state.mailingText
                    userIds.forEach( user_id => {
                        try {
                            ctx.telegram.sendVideo(user_id, file_id, contextToSend)
                            count += 1
                        } catch(e) {
                            console.log("can`t send message to user " + user_id)
                        }
                    })
                } else {
                    await ctx.reply("Неверный формат файла")
                }            
            }
            await ctx.reply("Рассылка отправлена " + count + " пользователям", await replyKeyboard.adminPanel())
        } catch(e) {
            await utils.sendError(ctx, e)
        }
        await ctx.scene.leave()
    },

    async (ctx) => {
        const dish = (ctx.message.text == "⬅️ назад" && typeof ctx.message.text == 'number' ) ? ctx.scene.state.searchQuery : ctx.message.text
        ctx.scene.state.searchQuery = dish
        const dishes = await utils.getDishesByName(dish)
        if(dishes.length > 0) {
            await ctx.reply("Выберите продукт", replyKeyboard.createDishesButtons(dishes))
            return ctx.wizard.next()
        } else {
            await ctx.reply("Продукты с таким названием не найдены\nВведите другое название")
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
            await ctx.reply("Введите текст рассылки", await replyKeyboard.back())
            return ctx.wizard.selectStep(2)
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    }
)

mailingScene.hears("⬅️ назад", async ctx => {
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

module.exports = mailingScene