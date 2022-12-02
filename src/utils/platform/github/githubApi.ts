/* eslint-disable @typescript-eslint/strict-boolean-expressions,prefer-const,@typescript-eslint/explicit-function-return-type */
import { IGithubCfg } from "~/utils/platform/github/githubCfg"
import { Octokit } from "@octokit/core"
import logUtil from "~/utils/logUtil"
import { Base64 } from "js-base64"

/**
 * Github API
 */
export class GithubApi {
  // 读取配置
  private readonly githubCfg: IGithubCfg

  // Octokit.js
  // https://github.com/octokit/core.js#readme
  private readonly octokit: Octokit

  constructor(githubCfg: IGithubCfg) {
    this.githubCfg = githubCfg
    this.octokit = new Octokit({
      auth: githubCfg.githubToken,
    })
  }

  /**
   * 获取Github文件的sha，如果文件不存在返回undefined，存在返回sha
   * 子类API使用，应用层面不建议直接调用
   * @param docPath 完整文件路径，例如：docs/_posts/测试.md
   */
  protected async getPageSha(docPath: string): Promise<string> {
    let sha

    const data = await this.getPageData(docPath)
    if (data) {
      sha = data.sha
    }
    return sha
  }

  /**
   * 获取Github文件的sha，如果文件不存在返回undefined，存在返回sha
   * 子类API使用，应用层面不建议直接调用
   * @param docPath 完整文件路径，例如：docs/_posts/测试.md
   */
  async getPageData(docPath: string): Promise<any> {
    let data

    let res
    const route =
      "GET /repos/" +
      this.githubCfg.githubUser +
      "/" +
      this.githubCfg.githubRepo +
      "/contents/" +
      docPath
    logUtil.logInfo("getPage route=>", route)
    res = await this.octokit.request(route, {
      owner: this.githubCfg.githubUser,
      repo: this.githubCfg.githubRepo,
      path: docPath,
    })
    logUtil.logInfo("getPage res=>", res)

    if (res) {
      data = res.data
    }
    return data
  }

  /**
   * 创建或更新页面
   * 子类API使用，应用层面不建议直接调用
   * @param docPath 页面路径，相对于根仓库的完整路径
   * @param mdContent Markdown文本
   * @param sha 文件的sha，undefined表示新建，更新需要传sha字符串
   */
  protected async createOrUpdatePage(
    docPath: string,
    mdContent: string,
    sha: any
  ) {
    let data

    let res
    // const base64 = Buffer.from(mdContent).toString('base64');
    const base64 = Base64.toBase64(mdContent)
    const route =
      "PUT /repos/" +
      this.githubCfg.githubUser +
      "/" +
      this.githubCfg.githubRepo +
      "/contents/" +
      docPath
    const options = {
      owner: this.githubCfg.githubUser,
      repo: this.githubCfg.githubRepo,
      path: docPath,
      message: this.githubCfg.defaultMsg,
      committer: {
        name: this.githubCfg.author,
        email: this.githubCfg.email,
      },
      content: base64,
    }
    if (sha) {
      Object.assign(options, {
        sha,
      })
    }

    res = await this.octokit.request(route, options)
    logUtil.logInfo("createOrUpdatePage res=>", res)

    if (res) {
      data = res.data
    }
    return data
  }

  /**
   * 删除页面
   * 子类API使用，应用层面不建议直接调用
   * @param docPath 页面路径，相对于根仓库的完整路径
   * @param sha 文件的sha，undefined表示新建，更新需要传sha字符串
   */
  protected async deletePage(docPath: string, sha: any) {
    let data

    const route =
      "DELETE /repos/" +
      this.githubCfg.githubUser +
      "/" +
      this.githubCfg.githubRepo +
      "/contents/" +
      docPath
    const options = {
      owner: this.githubCfg.githubUser,
      repo: this.githubCfg.githubRepo,
      path: docPath,
      message: this.githubCfg.defaultMsg,
      committer: {
        name: this.githubCfg.author,
        email: this.githubCfg.email,
      },
      sha,
    }

    const res = await this.octokit.request(route, options)
    logUtil.logInfo("deletePage res=>", res)

    if (res) {
      data = res.data
    }
    return data
  }

  // ===========================
  // 下面是公共方法，子类可酌情重写
  // ===========================
  /**
   * 发布文章到Github
   * @param docPath 相对于根仓库的完整路径，包括文件名和扩展名
   * @param mdContent Markdown文本
   */
  public async publishGithubPage(
    docPath: string,
    mdContent: string
  ): Promise<any> {
    // https://github.com/terwer/src-sy-post-publisher/issues/21
    const sha = undefined
    let res
    res = await this.createOrUpdatePage(docPath, mdContent, sha)
    logUtil.logInfo("Github publishPage,res=>", res)
    return res
  }

  /**
   * 更新文章到Github
   * @param docPath
   * @param mdContent
   */
  public async updateGithubPage(
    docPath: string,
    mdContent: string
  ): Promise<any> {
    // https://github.com/terwer/src-sy-post-publisher/issues/21
    const sha = await this.getPageSha(docPath)

    let res
    res = await this.createOrUpdatePage(docPath, mdContent, sha)
    logUtil.logInfo("Github updatePage,res=>", res)
    return res
  }

  /**
   * 删除Github发布的文章
   * @param docPath 对于根仓库的完整路径，包括文件名和扩展名
   */
  public async deleteGithubPage(docPath: string) {
    const sha = await this.getPageSha(docPath)

    let res
    res = await this.deletePage(docPath, sha)
    logUtil.logInfo("Github deletePage,res=>", res)
    return res
  }

  /**
   * 获取Github文件的sha，如果文件不存在返回undefined，存在返回sha
   * @param docPath 完整文件路径，例如：docs/_posts/测试.md
   */
  public async getGithubPageTreeNode(docPath: string): Promise<any[]> {
    const data = await this.getPageData(docPath)

    const treeNode = [] as any[]

    if (data && data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        const item = data[i]
        const node = {
          value: item.path,
          label: item.name,
          isLeaf: item.name.indexOf(".md") > -1,
        }
        treeNode.push(node)
      }
      logUtil.logInfo("getPageTreeNode,data=>", data)
    }

    return treeNode
  }
}
