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

import { createAppLogger } from "~/src/utils/appLogger.ts"
import { PublisherAppInstance } from "~/src/publisherAppInstance.ts"
import { useSettingStore } from "~/src/stores/useSettingStore.ts"
import { JsonUtil, ObjectUtil, StrUtil } from "zhi-common"
import { Utils } from "~/src/utils/utils.ts"
import { getDynPostidKey } from "~/src/platforms/dynamicConfig.ts"
import { CategoryTypeEnum } from "zhi-blog-api"
import { Gitlabvuepress2Config } from "~/src/adaptors/api/gitlab-vuepress2/gitlabvuepress2Config.ts"
import { Gitlabvuepress2YamlConverterAdaptor } from "~/src/adaptors/api/gitlab-vuepress2/gitlabvuepress2YamlConverterAdaptor.ts"
import { Gitlabvuepress2ApiAdaptor } from "~/src/adaptors/api/gitlab-vuepress2/gitlabvuepress2ApiAdaptor.ts"

const useGitlabvuepress2Api = async (key: string, newCfg?: Gitlabvuepress2Config) => {
  // 创建应用日志记录器
  const logger = createAppLogger("use-gitlab-hexo-api")

  // 记录开始使用 Hexo API
  logger.info("Start using Gitlabvuepress2 API...")

  // 创建应用实例
  const appInstance = new PublisherAppInstance()

  let cfg: Gitlabvuepress2Config
  if (newCfg) {
    logger.info("Initialize with the latest newCfg passed in...")
    cfg = newCfg
  } else {
    // 从配置中获取数据
    const { getSetting } = useSettingStore()
    const setting = await getSetting()
    cfg = JsonUtil.safeParse<Gitlabvuepress2Config>(setting[key], {} as Gitlabvuepress2Config)

    // 如果配置为空，则使用默认的环境变量值，并记录日志
    if (ObjectUtil.isEmptyObject(cfg)) {
      // 从环境变量获取 Hexo API 的 URL、认证令牌和其他配置信息
      const githubUsername = Utils.emptyOrDefault(process.env.VITE_GITLAB_USERNAME, "")
      const githubAuthToken = Utils.emptyOrDefault(process.env.VITE_GITLAB_AUTH_TOKEN, "")
      const githubRepo = Utils.emptyOrDefault(process.env.VITE_GITLAB_REPO, "")
      const githubBranch = Utils.emptyOrDefault(process.env.VITE_GITLAB_BRANCH, "main")
      const middlewareUrl = Utils.emptyOrDefault(
        process.env.VITE_MIDDLEWARE_URL,
        "https://api.terwer.space/api/middleware"
      )
      cfg = new Gitlabvuepress2Config(githubUsername, githubAuthToken, githubRepo, githubBranch, middlewareUrl)
      logger.info("Configuration is empty, using default environment variables.")
    } else {
      logger.info("Using configuration from settings...")
    }
    // 初始化posidKey
    if (StrUtil.isEmptyString(cfg.posidKey)) {
      // 默认值
      cfg.posidKey = getDynPostidKey(key)
    }
  }

  // 文件规则
  cfg.mdFilenameRule = "[slug].md"
  // 标签
  cfg.tagEnabled = true
  // 分类
  cfg.cateEnabled = true
  cfg.allowCateChange = true
  cfg.categoryType = CategoryTypeEnum.CategoryType_Multi
  // 知识空间
  cfg.knowledgeSpaceEnabled = true
  cfg.knowledgeSpaceTitle = "发布目录"
  cfg.allowKnowledgeSpaceChange = false
  cfg.placeholder.knowledgeSpaceReadonlyModeTip =
    "Gitlabvuepress2 平台暂不支持修改发布目录，如需修改，请删除之后重新发布"
  cfg.knowledgeSpaceType = CategoryTypeEnum.CategoryType_Tree_Single

  // 创建 Hexo 的 yamlAdaptor
  const yamlAdaptor = new Gitlabvuepress2YamlConverterAdaptor()

  // 创建 Hexo API 适配器
  const blogApi = new Gitlabvuepress2ApiAdaptor(appInstance, cfg)
  logger.info("Gitlabvuepress2 API created successfully.", cfg)

  return {
    cfg,
    yamlAdaptor,
    blogApi,
  }
}

export { useGitlabvuepress2Api }
