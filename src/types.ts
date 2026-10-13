export interface ZenTaoStory {
  id: number;
  product: number;
  branch?: number;
  module?: number;
  plan?: number | string;
  source?: string;
  sourceNote?: string;
  fromBug?: number;
  title: string;
  keywords?: string;
  category?: "feature" | "interface" | "performance" | "safe" | "experience" | "other" | string;
  pri?: number;
  estimate?: number;
  status?: string;
  subStatus?: string;
  stage?: string;
  version?: number;
  spec?: string;
  verify?: string;
  openedBy?: string;
  openedDate?: string;
  assignedTo?: string | { account?: string; realname?: string };
  assignedDate?: string;
  reviewedBy?: string;
  reviewedDate?: string;
  closedBy?: string;
  closedDate?: string;
  closedReason?: string;
  toBug?: number;
  lastEditedBy?: string;
  lastEditedDate?: string;
  tthldesign?: string;
  ttdevtest?: string;
  bz?: string;
  ttmedicalrisk?: string;
  ttisdatasafe?: string;
  reviewer?: string[] | string;
  parent?: number;
  ttplan?: string;
  ttisperformance?: string;
  ttisdesigncheck?: string;
  ttnetsafe?: string;
  [key: string]: unknown;
}

export interface ZenTaoProduct {
  id: number;
  name: string;
  code?: string;
  line?: number;
  type?: string;
  status?: string;
  desc?: string;
  PO?: string;
  QD?: string;
  RD?: string;
  acl?: string;
  createdDate?: string;
}

export interface ZenTaoPlan {
  id: number;
  product: number;
  branch?: number;
  title: string;
  desc?: string;
  begin?: string;
  end?: string;
  status?: string;
  stories?: unknown[];
  bugs?: unknown[];
}

export interface ZenTaoProject {
  id: number;
  project?: number;
  model?: string;
  type?: string;
  lifetime?: string;
  budget?: string;
  budgetUnit?: string;
  name: string;
  code?: string;
  begin?: string;
  end?: string;
  status?: string;
  PM?: string | { account?: string; realname?: string };
  desc?: string;
  openedBy?: string;
  openedDate?: string;
  [key: string]: unknown;
}

export interface ZenTaoExecution {
  id: number;
  project?: number;
  name: string;
  code?: string;
  type?: string;
  lifetime?: string;
  begin?: string;
  end?: string;
  status?: string;
  PM?: string | { account?: string; realname?: string };
  desc?: string;
  openedBy?: string;
  openedDate?: string;
  stories?: unknown[];
  tasks?: unknown[];
  [key: string]: unknown;
}

export interface ZenTaoPagination<T> {
  page: number;
  total: number;
  limit: number;
  products?: T[];
  stories?: T[];
  plans?: T[];
  tasks?: T[];
  projects?: T[];
  executions?: T[];
}

export interface ZenTaoTask {
  id: number;
  project?: number;
  execution: number;
  executionID?: number;
  module?: number;
  story?: number;
  storyVersion?: number;
  name: string;
  type: string;
  pri?: number;
  estimate?: number;
  left?: number;
  consumed?: number;
  status?: "wait" | "doing" | "done" | "pause" | "cancel" | "closed" | string;
  subStatus?: string;
  color?: string;
  mailto?: string[];
  desc?: string;
  version?: number;
  openedBy?: string | { account?: string; realname?: string };
  openedDate?: string;
  assignedTo?: string | { account?: string; realname?: string };
  assignedDate?: string;
  estStarted?: string;
  realStarted?: string;
  deadline?: string;
  finishedBy?: string | { account?: string; realname?: string };
  finishedDate?: string;
  canceledBy?: string;
  canceledDate?: string;
  closedBy?: string | { account?: string; realname?: string };
  closedDate?: string;
  closedReason?: string;
  lastEditedBy?: string;
  lastEditedDate?: string;
  [key: string]: unknown;
}

export interface LoginResult {
  token: string;
}

export interface StoryChangeResult {
  id: number;
  version: number;
  status: string;
  title: string;
  spec?: string;
  verify?: string;
}

