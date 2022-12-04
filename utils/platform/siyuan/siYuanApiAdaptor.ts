/*
 * Copyright (c) 2022, Terwer . All rights reserved.
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

import { IApi } from "~/utils/api"
import { SiYuanApi } from "~/utils/platform/siyuan/siYuanApi"
import { UserBlog } from "~/utils/common/userBlog"
import { API_TYPE_CONSTANTS } from "~/utils/constants/apiTypeConstants"

/**
 * 思源笔记API适配器
 */
export class SiYuanApiAdaptor implements IApi {
  private readonly siyuanApi: SiYuanApi

  constructor() {
    this.siyuanApi = new SiYuanApi()
  }

  public async getUsersBlogs(): Promise<UserBlog[]> {
    const result: UserBlog[] = []

    const userBlog = new UserBlog()
    userBlog.blogid = API_TYPE_CONSTANTS.API_TYPE_SIYUAN
    userBlog.blogName = API_TYPE_CONSTANTS.API_TYPE_SIYUAN
    userBlog.url = process.env.SIYUAN_API_URL ?? ""
    result.push(userBlog)

    return result
  }

  public async getRecentPostsCount(keyword?: string): Promise<number> {
    return await getRootBlocksCount(keyword ?? "")
  }

  // @ts-expect-error
  public async getRecentPosts(
    numOfPosts: number,
    page: number,
    keyword?: string
  ): Promise<Post[]> {
    const result: Post[] = []

    let pg = 0
    if (page) {
      pg = page
    }
    const k = keyword ?? ""
    const siyuanPosts = await getRootBlocks(pg, numOfPosts, k)
    // logUtil.logInfo(siyuanPosts)

    for (let i = 0; i < siyuanPosts.length; i++) {
      const siyuanPost = siyuanPosts[i]

      // 某些属性详情页控制即可
      const attrs = await getBlockAttrs(siyuanPost.root_id)
      const page = await this.getPost(siyuanPost.root_id)

      // // 发布状态
      // let isPublished = true
      // const publishStatus = attrs["custom-publish-status"] || "draft"
      // if (publishStatus == "secret") {
      //     isPublished = false;
      // }
      //
      // // 访问密码
      // const postPassword = attrs["custom-publish-password"] || ""

      // 文章别名
      const customSlug = attrs["custom-slug"] || ""

      // 适配公共属性
      const commonPost = new Post()
      commonPost.postid = siyuanPost.root_id
      commonPost.title = siyuanPost.content
      commonPost.permalink =
        customSlug === ""
          ? "/post/" + siyuanPost.root_id
          : "/post/" + customSlug + ".html"
      // commonPost.isPublished = isPublished
      commonPost.mt_keywords = page.mt_keywords
      commonPost.description = page.description
      result.push(commonPost)
    }

    return await Promise.resolve(result)
  }

  public async getPost(postid: string, useSlug?: boolean): Promise<Post> {
    let pid = postid
    if (useSlug) {
      const pidObj = await getBlockBySlug(postid)
      if (pidObj) {
        pid = pidObj.root_id
      }
    }
    const siyuanPost = await getBlockByID(pid)
    if (!siyuanPost) {
      throw new Error("文章不存存在，postid=>" + pid)
    }

    const attrs = await getBlockAttrs(pid)
    const md = await exportMdContent(pid)

    // 发布状态
    let isPublished = true
    const publishStatus = attrs["custom-publish-status"] || "draft"
    if (publishStatus === "secret") {
      isPublished = false
    }

    // 访问密码
    const postPassword = attrs["custom-post-password"] || ""

    // 访问密码
    const shortDesc = attrs["custom-desc"] || ""

    // 渲染Markdown
    let html = renderHTML(md.content)
    // 移除挂件html
    html = removeWidgetTag(html)

    // 适配公共属性
    const commonPost = new Post()
    commonPost.postid = siyuanPost.root_id || ""
    commonPost.title = siyuanPost.content || ""
    commonPost.description = html || ""
    commonPost.shortDesc = shortDesc || ""
    commonPost.mt_keywords = attrs.tags || ""
    commonPost.post_status = isPublished
      ? POST_STATUS_CONSTANTS.POST_STATUS_PUBLISH
      : POST_STATUS_CONSTANTS.POST_TYPE_DRAFT
    commonPost.wp_password = postPassword
    // commonPost.dateCreated

    return commonPost
  }

  public async editPost(
    postid: string,
    post: Post,
    publish?: boolean
  ): Promise<boolean> {
    return await Promise.resolve(false)
  }

  public async newPost(post: Post, publish?: boolean): Promise<string> {
    return await Promise.resolve("")
  }

  public async deletePost(postid: string): Promise<boolean> {
    return await Promise.resolve(false)
  }

  public async getCategories(): Promise<CategoryInfo[]> {
    return await Promise.resolve([])
  }

  public async getPreviewUrl(postid: string): Promise<string> {
    return await Promise.resolve("")
  }

  // ===============================================
  // 下面是思源笔记独有的API
  // ===============================================

  public async getSubPostCount(postid: string): Promise<number> {
    return await getSubdocCount(postid)
  }

  public async getSubPosts(
    postid: string,
    numOfPosts: number,
    page: number,
    keyword?: string
  ): Promise<Post[]> {
    const result: Post[] = []

    let pg = 0
    if (page !== 0) {
      pg = page
    }
    const k = keyword != null ?? ""
    // @ts-expect-error
    const siyuanPosts = await getSubdocs(postid, pg, numOfPosts, k)
    // logUtil.logInfo(siyuanPosts)

    for (let i = 0; i < siyuanPosts.length; i++) {
      const siyuanPost = siyuanPosts[i]

      // 某些属性详情页控制即可
      const attrs = await getBlockAttrs(siyuanPost.root_id)
      const page = await this.getPost(siyuanPost.root_id)

      // // 发布状态
      // let isPublished = true
      // const publishStatus = attrs["custom-publish-status"] || "draft"
      // if (publishStatus == "secret") {
      //     isPublished = false;
      // }
      //
      // // 访问密码
      // const postPassword = attrs["custom-publish-password"] || ""

      // 文章别名
      const customSlug = attrs["custom-slug"] || ""

      // 适配公共属性
      const commonPost = new Post()
      commonPost.postid = siyuanPost.root_id
      commonPost.title = siyuanPost.content
      commonPost.permalink =
        customSlug === ""
          ? "/post/" + siyuanPost.root_id
          : "/post/" + customSlug + ".html"
      // commonPost.isPublished = isPublished
      commonPost.mt_keywords = page.mt_keywords
      commonPost.description = page.description
      result.push(commonPost)
    }

    return await Promise.resolve(result)
  }
}
