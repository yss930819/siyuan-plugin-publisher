/*
 * Copyright (c) 2023, Terwer . All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Terwer designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Terwer in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Terwer, Shenzhen, Guangdong, China, youweics@163.com
 * or visit www.terwer.space if you need additional information or have any
 * questions.
 */

import { IBlogApi } from "zhi-blog-api/dist/lib/IBlogApi"
import { IWebApi } from "zhi-blog-api/dist/lib/IWebApi"
import { BaseBlogApi } from "~/src/adaptors/api/base/baseBlogApi.ts"
import { BaseWebApi } from "~/src/adaptors/web/base/baseWebApi.ts"
import { BlogConfig, MediaObject, Post, WebApi } from "zhi-blog-api"
import { createAppLogger, ILogger } from "~/src/utils/appLogger.ts"
import { LuteUtil } from "~/src/utils/luteUtil.ts"
import { usePicgoBridge } from "~/src/composables/usePicgoBridge.ts"
import { base64ToBuffer, remoteImageToBase64Info, toBase64Info } from "~/src/utils/polyfillUtils.ts"
import { StrUtil } from "zhi-common"
import { useSiyuanDevice } from "~/src/composables/useSiyuanDevice.ts"
import { isFileExists } from "~/src/utils/siyuanUtils.ts"
import { useSiyuanApi } from "~/src/composables/useSiyuanApi.ts"
import { SiyuanKernelApi } from "zhi-siyuan-api"
import { DynamicConfig } from "~/src/platforms/dynamicConfig.ts"

/**
 * 各种模式共享的扩展基类
 *
 * @author terwer
 * @since 1.8.0
 */
class BaseExtendApi extends WebApi implements IBlogApi, IWebApi {
  private readonly logger: ILogger
  private readonly api: BaseBlogApi | BaseWebApi
  protected readonly picgoBridge: any
  private readonly isSiyuanOrSiyuanNewWin: boolean
  private readonly kernelApi: SiyuanKernelApi

  constructor(api: BaseBlogApi | BaseWebApi) {
    super()
    this.logger = createAppLogger("base-extend-api")
    this.api = api

    this.picgoBridge = usePicgoBridge()
    const { isInSiyuanOrSiyuanNewWin } = useSiyuanDevice()
    this.isSiyuanOrSiyuanNewWin = isInSiyuanOrSiyuanNewWin()
    const { kernelApi } = useSiyuanApi()
    this.kernelApi = kernelApi
  }

  public async preEditPost(post: Post, id?: string, publishCfg?: any): Promise<Post> {
    const cfg: BlogConfig = publishCfg.cfg
    const dynCfg: DynamicConfig = publishCfg.dynCfg

    // 判断key包含zhihu、notion，custom_Zhihu 或者 /custom_Zhihu-\w+/
    const unsupportedPicturePlatform: string[] = ["custom_Zhihu", "custom_Notion"]
    const isPicgoInstalled: boolean = await this.checkPicgoInstalled()
    if (!isPicgoInstalled) {
      this.logger.warn("未安装 PicGO 插件，将使用平台上传图片")
    }
    // 注意如果 platformKey=custom_Zhihu 或者 custom_Zhihu-xxx custom_Notion-xxx 也算 可以参考 /custom_Zhihu-\w+/
    const notSupportPictureUrl: boolean = unsupportedPicturePlatform.some((platform) => {
      const regex = new RegExp(`${platform}(-\\w+)?`)
      return regex.test(dynCfg.platformKey)
    })
    if (notSupportPictureUrl) {
      this.logger.warn("该平台不支持 Picgo 插件，将使用平台上传图片")
    }
    const usePicgo: boolean = isPicgoInstalled && !notSupportPictureUrl

    if (usePicgo) {
      // ==========================
      // 使用 PicGO上传图片
      // ==========================
      // 图片替换
      this.logger.debug("使用 PicGO上传图片")
      this.logger.debug("开始图片处理, post =>", { post })
      post.markdown = await this.picgoBridge.handlePicgo(id, post.markdown)
      // 利用 lute 把 md 转换成 html
      post.html = LuteUtil.mdToHtml(post.markdown)
      this.logger.debug("图片处理完毕, post.markdown =>", { md: post.markdown })
    } else {
      // ==========================
      // 使用平台上传图片
      // ==========================
      this.logger.debug("使用平台上传图片")
      // 找到所有的图片
      const images = await this.picgoBridge.getImageItemsFromMd(id, post.markdown)
      if (images.length === 0) {
        this.logger.info("未找到图片，不处理")
        return post
      }
      // 批量处理图片上传
      this.logger.info(`找到${images.length}张图片，开始上传`)
      const urlMap = {}
      for (const image of images) {
        const imageUrl = image.url
        const base64Info = await this.readFileToBase64(imageUrl, cfg)
        const bits = base64ToBuffer(base64Info.imageBase64)
        const mediaObject = new MediaObject(image.name, base64Info.mimeType, bits)
        this.logger.debug("before upload, mediaObject =>", mediaObject)
        const attachResult = await this.api.newMediaObject(mediaObject)
        this.logger.debug("attachResult =>", attachResult)
        if (attachResult && attachResult.url) {
          urlMap[image.originUrl] = attachResult.url
        }
      }
      this.logger.info("平台图片全部上传完成，urlMap =>", urlMap)
    }

    return post
  }

  // ================
  // private methods
  // ================
  private async checkPicgoInstalled() {
    // 检测是否安装 picgo 插件
    return await isFileExists(this.kernelApi, "/data/plugins/siyuan-plugin-picgo/plugin.json", "text")
  }

  private async readFileToBase64(url: string, cfg: BlogConfig): Promise<any> {
    let base64Info: any
    if (this.isSiyuanOrSiyuanNewWin) {
      this.logger.info("Inside Siyuan notes, use the built-in request to obtain base64")
      base64Info = await remoteImageToBase64Info(url)
    } else {
      this.logger.info("Outside the browser, use an image proxy")
      const middlewareUrl = StrUtil.isEmptyString(cfg.middlewareUrl)
        ? "https://api.terwer.space/api/middleware"
        : cfg.middlewareUrl
      const response = await this.api.proxyFetch(`${middlewareUrl}/image`, [], { url: url }, "POST")
      this.logger.debug("readFileToBase64 proxyFetch response =>", response)
      const resBody = response.body
      const base64String = resBody.base64
      base64Info = toBase64Info(url, base64String)
    }

    this.logger.info("readFileToBase64 proxyFetch base64Info =>", { base64Info })
    return base64Info
  }
}

export { BaseExtendApi }
