/* ══════════════════════════════════════
   SHIELD — ingredient.js
   총 253개 성분 내장 (system 데이터)
   + localStorage custom 데이터 동적 추가
══════════════════════════════════════ */

var INGREDIENTS = [
  {
    "ko": "가수분해 케라틴",
    "en": "Hydrolyzed Keratin",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "손상 모발 내부 채움 / 강도 회복",
    "strength": "중",
    "feature": "모발 보강, 탄력 회복",
    "desc": "모발의 주성분인 케라틴을 잘게 분해해 손상된 모발 내부 빈 공간을 채워준다. 사용 후 모발이 탱탱하고 끊어지지 않는 느낌이 든다.",
    "source": "system"
  },
  {
    "ko": "가수분해 콜라겐",
    "en": "Hydrolyzed Collagen",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 수분 유지 / 부드러움",
    "strength": "약",
    "feature": "보습, 유연성",
    "desc": "콜라겐을 작게 분해해 모발에 수분을 잡아두는 역할을 한다. 건조하고 뻣뻣한 모발을 부드럽고 유연하게 만들어준다.",
    "source": "system"
  },
  {
    "ko": "가수분해 밀 단백질",
    "en": "Hydrolyzed Wheat Protein",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 표면 코팅 / 볼륨감",
    "strength": "약",
    "feature": "코팅, 윤기",
    "desc": "밀에서 추출한 단백질로 모발 표면을 감싸 윤기와 볼륨감을 준다. 가는 모발이나 힘없는 모발에 효과적이다.",
    "source": "system"
  },
  {
    "ko": "가수분해 실크",
    "en": "Hydrolyzed Silk",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 광택 / 매끄러운 표면 형성",
    "strength": "약",
    "feature": "실키감, 광택",
    "desc": "실크를 분해해 만든 성분으로 모발 표면을 매끄럽게 코팅해 눈에 띄는 광택을 만든다. 손으로 만졌을 때 비단처럼 미끄럽게 느껴진다.",
    "source": "system"
  },
  {
    "ko": "판테놀",
    "en": "Panthenol",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발·두피 수분 공급 / 탄력 유지",
    "strength": "약",
    "feature": "보습, 수분 유지",
    "desc": "비타민 B5 전구체로 모발과 두피 속으로 흡수되어 수분을 잡아둔다. 건조하고 끊어지기 쉬운 모발에 탄력과 유연성을 준다.",
    "source": "system"
  },
  {
    "ko": "세틸 알코올",
    "en": "Cetyl Alcohol",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 표면 부드러움 / 크림 질감 형성",
    "strength": "약",
    "feature": "유연제, 제형 안정",
    "desc": "지방 알코올 계열로 모발 표면을 부드럽게 코팅한다. 제품에서는 크리미한 질감을 만드는 데 기여하며, 사용 후 매끄러운 느낌을 만든다.",
    "source": "system"
  },
  {
    "ko": "스테아릴 알코올",
    "en": "Stearyl Alcohol",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 코팅 / 제형 안정",
    "strength": "약",
    "feature": "유연제, 윤기",
    "desc": "세틸 알코올과 유사한 지방 알코올로 모발 표면을 감싸 윤기와 부드러움을 만들어준다. 보통 세틸 알코올과 함께 사용된다.",
    "source": "system"
  },
  {
    "ko": "베헨트리모늄 클로라이드",
    "en": "Behentrimonium Chloride",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "정전기 방지 / 컨디셔닝",
    "strength": "중",
    "feature": "정전기 억제, 매끄러움",
    "desc": "양이온 계면활성제로 손상된 모발 표면의 음전하를 중화해 정전기를 잡아준다. 빗질이 쉬워지고 모발이 매끄럽게 정돈된다.",
    "source": "system"
  },
  {
    "ko": "세트리모늄 클로라이드",
    "en": "Cetrimonium Chloride",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "정전기 방지 / 컨디셔닝",
    "strength": "중",
    "feature": "정전기 억제, 컨디셔닝",
    "desc": "양이온 성분으로 모발 표면에 달라붙어 정전기를 억제하고 부드러운 감촉을 만든다. 베헨트리모늄보다 가벼운 편이다.",
    "source": "system"
  },
  {
    "ko": "다이메티콘",
    "en": "Dimethicone",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 표면 코팅 / 윤기 및 부드러움",
    "strength": "강",
    "feature": "실리콘 코팅, 고광택",
    "desc": "실리콘 계열로 모발 표면에 얇은 막을 형성해 강한 윤기와 부드러운 감촉을 만든다. 열 차단 효과도 있어 고데기 사용 전 보호막 역할을 한다. 과도하게 사용하면 모발이 무거워질 수 있다.",
    "source": "system"
  },
  {
    "ko": "사이클로메티콘",
    "en": "Cyclomethicone",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "가벼운 코팅 / 퍼짐성 개선",
    "strength": "약",
    "feature": "휘발성 실리콘, 가벼운 코팅",
    "desc": "가벼운 휘발성 실리콘으로 발림성을 좋게 만들고 끈적임 없이 모발을 코팅한다. 무거운 실리콘의 단점 없이 부드러운 감촉을 준다.",
    "source": "system"
  },
  {
    "ko": "아르간 오일",
    "en": "Argania Spinosa Kernel Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발·두피 영양 / 건조함 개선",
    "strength": "중",
    "feature": "고영양, 광택",
    "desc": "모로코산 아르간 나무 열매에서 추출한 오일로 올레산과 비타민 E가 풍부하다. 모발에 영양을 주고 건조함을 잡아주며 사용 후 자연스러운 광택이 생긴다.",
    "source": "system"
  },
  {
    "ko": "코코넛 오일",
    "en": "Cocos Nucifera Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 내부 침투 영양 / 단백질 손실 억제",
    "strength": "중",
    "feature": "내부 침투, 영양",
    "desc": "모발 내부까지 침투할 수 있는 몇 안 되는 오일 중 하나다. 모발 내부 단백질이 빠져나가는 것을 막아주며 촉촉하고 건강한 상태를 유지시킨다.",
    "source": "system"
  },
  {
    "ko": "호호바 오일",
    "en": "Simmondsia Chinensis Seed Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "두피 유수분 밸런스 / 모발 보호",
    "strength": "약",
    "feature": "두피 밸런스, 가벼운 보습",
    "desc": "왁스 에스터 구조로 피부와 두피의 피지와 유사하다. 가볍게 흡수되어 두피의 유수분 밸런스를 맞춰주고 끈적임 없이 모발을 보호한다.",
    "source": "system"
  },
  {
    "ko": "동백 오일",
    "en": "Camellia Japonica Seed Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 광택 / 열 보호",
    "strength": "중",
    "feature": "광택, 열 보호",
    "desc": "올레산 함량이 높아 모발 표면을 부드럽게 코팅하고 윤기를 더해준다. 열에 안정적이어서 드라이 전 사용 시 열 손상을 줄여준다.",
    "source": "system"
  },
  {
    "ko": "글리세린",
    "en": "Glycerin",
    "cat": "크리닉",
    "mid": "보습",
    "role": "수분 끌어당김 / 건조함 방지",
    "strength": "약",
    "feature": "보습, 수분 흡습",
    "desc": "공기 중 수분을 끌어당겨 모발과 두피에 붙잡아두는 역할을 한다. 건조한 환경에서는 효과가 제한될 수 있으며, 습한 환경에서 더 효과적이다.",
    "source": "system"
  },
  {
    "ko": "히알루론산",
    "en": "Hyaluronic Acid",
    "cat": "크리닉",
    "mid": "보습",
    "role": "고보습 / 두피 수분 공급",
    "strength": "약",
    "feature": "고보습, 수분 유지",
    "desc": "자기 무게의 수백 배 수분을 잡아두는 능력을 가진 성분이다. 두피와 모발에 수분을 공급하고 건조함으로 인한 푸석함을 개선한다.",
    "source": "system"
  },
  {
    "ko": "세라마이드",
    "en": "Ceramide NP",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 큐티클 보호 / 수분 손실 차단",
    "strength": "중",
    "feature": "큐티클 보호, 수분 유지",
    "desc": "모발 큐티클 사이 빈 공간을 채워 수분이 빠져나가는 것을 막는다. 화학 시술 후 열린 큐티클을 정돈하고 손상된 모발 구조를 회복하는 데 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "쉐어버터",
    "en": "Butyrospermum Parkii Butter",
    "cat": "크리닉",
    "mid": "보습",
    "role": "고보습 코팅 / 거친 모발 정돈",
    "strength": "중",
    "feature": "고보습, 부드러움",
    "desc": "아프리카 시어 나무 열매에서 얻은 버터로 유분이 풍부해 건조하고 거친 모발을 부드럽게 만들어준다. 도포 후 모발 표면이 촉촉하고 매끄럽게 정돈된다.",
    "source": "system"
  },
  {
    "ko": "알로에베라 추출물",
    "en": "Aloe Barbadensis Leaf Extract",
    "cat": "크리닉",
    "mid": "보습",
    "role": "두피 진정 / 가벼운 수분 공급",
    "strength": "약",
    "feature": "진정, 보습",
    "desc": "알로에 잎에서 추출한 성분으로 두피 자극을 진정시키고 가볍게 수분을 공급한다. 예민하거나 붉어진 두피에 사용하면 편안함을 준다.",
    "source": "system"
  },
  {
    "ko": "치오글리콜산 암모늄",
    "en": "Ammonium Thioglycolate",
    "cat": "펌제",
    "mid": "환원제",
    "role": "모발 내부 결합 풀기 / 형태 변형 가능하게 함",
    "strength": "강",
    "feature": "결합 분해, 형태 변형",
    "desc": "펌제 1제의 핵심 성분으로 모발 내부 시스틴 결합을 풀어 형태를 자유롭게 바꿀 수 있게 만든다. 농도와 pH, 방치 시간에 따라 작용력이 크게 달라진다.",
    "source": "system"
  },
  {
    "ko": "시스테아민 염산염",
    "en": "Cysteamine HCl",
    "cat": "펌제",
    "mid": "환원제",
    "role": "모발 결합 분해 / 저자극 환원",
    "strength": "중",
    "feature": "저자극 환원, 균일한 작용",
    "desc": "치오글리콜산보다 자극이 낮은 환원제로 모발 내부 결합을 부드럽게 풀어준다. 손상 모발이나 예민한 두피에도 비교적 안전하게 사용할 수 있다.",
    "source": "system"
  },
  {
    "ko": "글리세릴 모노치오글리콜레이트",
    "en": "Glyceryl Monothioglycolate",
    "cat": "펌제",
    "mid": "환원제",
    "role": "산성 조건 환원 / 지속성 웨이브",
    "strength": "중",
    "feature": "산성 환원, 웨이브 지속",
    "desc": "산성 pH에서 작용하는 환원제로 모발 손상이 비교적 적고 웨이브 지속력이 높다. 알칼리 환원제에 비해 작용 시간이 길 수 있다.",
    "source": "system"
  },
  {
    "ko": "과산화수소",
    "en": "Hydrogen Peroxide",
    "cat": "염모제",
    "mid": "산화제",
    "role": "모발 멜라닌 탈색 / 염료 발색",
    "strength": "강",
    "feature": "탈색, 산화 발색",
    "desc": "2제(산화제)의 핵심 성분으로 모발 내부 멜라닌을 분해해 색을 밝히고, 염료를 모발 안에서 발색시킨다. 농도(볼륨)가 높을수록 탈색력이 강해진다.",
    "source": "system"
  },
  {
    "ko": "암모니아수",
    "en": "Ammonium Hydroxide",
    "cat": "염모제",
    "mid": "알칼리",
    "role": "모발 큐티클 열기 / 염료 침투 유도",
    "strength": "강",
    "feature": "큐티클 개방, 염료 침투",
    "desc": "모발 큐티클을 부풀려 열어주는 역할을 한다. 이 과정이 있어야 염료와 과산화수소가 모발 내부로 들어갈 수 있다. 특유의 냄새가 나며 과도하면 모발 손상이 크다.",
    "source": "system"
  },
  {
    "ko": "에탄올아민",
    "en": "Ethanolamine",
    "cat": "염모제",
    "mid": "알칼리",
    "role": "큐티클 팽창 / 암모니아 대체 알칼리",
    "strength": "중",
    "feature": "저취 알칼리, 큐티클 개방",
    "desc": "암모니아보다 냄새가 적은 알칼리 성분으로 큐티클을 열어 염료가 들어갈 수 있게 한다. 암모니아 프리 제품에 자주 사용되며 모발에 더 잘 남아있어 자극이 지속될 수 있다.",
    "source": "system"
  },
  {
    "ko": "파라페닐렌디아민",
    "en": "p-Phenylenediamine",
    "cat": "염모제",
    "mid": "염료",
    "role": "영구 염색 발색 / 짙은 색상 구현",
    "strength": "강",
    "feature": "영구 발색, 짙은 색상",
    "desc": "PPD라고도 불리는 영구 염모제의 핵심 염료다. 과산화수소와 반응해 모발 내부에서 발색된다. 알레르기 반응을 일으킬 수 있어 사전 패치 테스트가 필수다.",
    "source": "system"
  },
  {
    "ko": "레조시놀",
    "en": "Resorcinol",
    "cat": "염모제",
    "mid": "염료",
    "role": "황금·붉은 색조 구현 / 색상 보조",
    "strength": "중",
    "feature": "색상 보조, 발색 강화",
    "desc": "PPD 등 주요 염료와 함께 사용되어 황금빛이나 붉은 계열 색조를 만든다. 단독으로는 발색력이 약하지만 다른 염료와 결합하면 색을 풍부하게 만든다.",
    "source": "system"
  },
  {
    "ko": "아미노페놀",
    "en": "p-Aminophenol",
    "cat": "염모제",
    "mid": "염료",
    "role": "산화 발색 보조 / 색상 심도 부여",
    "strength": "중",
    "feature": "발색 보조, 산화 커플러",
    "desc": "산화 커플러로서 PPD와 반응해 다양한 색상을 만드는 데 기여한다. 짙고 깊이 있는 색상을 구현할 때 사용된다.",
    "source": "system"
  },
  {
    "ko": "헤나",
    "en": "Lawsonia Inermis",
    "cat": "염모제",
    "mid": "염료",
    "role": "천연 적갈색 발색 / 코팅형 염색",
    "strength": "중",
    "feature": "천연 발색, 모발 코팅",
    "desc": "식물 유래 천연 염료로 모발을 적갈색으로 물들이며 동시에 코팅 효과를 준다. 화학 염모제와 달리 모발 내부에 침투하지 않고 표면에 결합하는 방식이다.",
    "source": "system"
  },
  {
    "ko": "인디고페라 틴크토리아",
    "en": "Indigofera Tinctoria Leaf Powder",
    "cat": "염모제",
    "mid": "염료",
    "role": "천연 청색·흑색 발색 / 헤나 보조",
    "strength": "중",
    "feature": "천연 발색, 청흑 색조",
    "desc": "천연 인디고 염료로 헤나와 혼합 사용 시 짙은 갈색이나 검은색 계열 발색이 가능하다. 단독 사용보다 헤나와 함께 사용할 때 더 효과적이다.",
    "source": "system"
  },
  {
    "ko": "소듐 라우릴 설페이트",
    "en": "Sodium Lauryl Sulfate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "강력한 유분·오염 세정",
    "strength": "강",
    "feature": "강한 세정력, 고기포",
    "desc": "SLS로 불리는 강한 음이온 계면활성제다. 세정력이 강해 두피 유분과 스타일링 제품 잔여물을 잘 씻어낸다. 과도하게 사용하면 두피 건조함이나 자극을 유발할 수 있다.",
    "source": "system"
  },
  {
    "ko": "소듐 라우레스 설페이트",
    "en": "Sodium Laureth Sulfate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "거품 풍부한 세정",
    "strength": "중",
    "feature": "세정력, 기포력",
    "desc": "SLES로 불리며 SLS보다 자극이 적은 계면활성제다. 풍성한 거품과 충분한 세정력을 갖고 있어 가장 많이 사용되는 샴푸 베이스 성분 중 하나다.",
    "source": "system"
  },
  {
    "ko": "코카미도프로필 베타인",
    "en": "Cocamidopropyl Betaine",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "부드러운 세정 / 자극 완화",
    "strength": "약",
    "feature": "저자극, 거품 안정",
    "desc": "코코넛 유래 양쪽성 계면활성제로 자극이 적고 강한 계면활성제의 자극을 줄여주는 역할을 한다. 민감한 두피용 샴푸에 자주 사용된다.",
    "source": "system"
  },
  {
    "ko": "소듐 코코일 이세티오네이트",
    "en": "Sodium Cocoyl Isethionate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "저자극 세정 / 피부 유사 보습",
    "strength": "약",
    "feature": "저자극, 촉촉한 세정",
    "desc": "코코넛 유래 저자극 계면활성제로 세정 후에도 두피와 모발이 당기거나 뻑뻑하지 않다. 건성 또는 민감 두피용 제품에 많이 활용된다.",
    "source": "system"
  },
  {
    "ko": "코코글루코사이드",
    "en": "Coco-Glucoside",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "천연 유래 저자극 세정",
    "strength": "약",
    "feature": "천연 유래, 저자극",
    "desc": "코코넛과 포도당에서 만든 계면활성제로 자극이 적고 피부 친화적이다. 자연주의 제품이나 영유아용 제품에도 활용될 만큼 순하다.",
    "source": "system"
  },
  {
    "ko": "데실 글루코사이드",
    "en": "Decyl Glucoside",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "순한 세정 / 예민 두피 사용 가능",
    "strength": "약",
    "feature": "천연 유래, 약한 자극",
    "desc": "식물 유래 순한 계면활성제로 코코글루코사이드와 유사하다. 민감하거나 자극받은 두피에도 사용할 수 있으며 거품은 적은 편이다.",
    "source": "system"
  },
  {
    "ko": "소듐 클로라이드",
    "en": "Sodium Chloride",
    "cat": "세정",
    "mid": "점도조절",
    "role": "제품 농도 조절",
    "strength": "약",
    "feature": "점도 조절, 농도 유지",
    "desc": "일반 소금으로 샴푸 등 제품의 점도를 조절하는 데 사용된다. 보존제 역할도 일부 하며 농도가 너무 높으면 오히려 점도가 낮아질 수 있다.",
    "source": "system"
  },
  {
    "ko": "징크 피리치온",
    "en": "Zinc Pyrithione",
    "cat": "두피",
    "mid": "항비듬",
    "role": "비듬 원인균 억제 / 두피 가려움 완화",
    "strength": "강",
    "feature": "항균, 비듬 억제",
    "desc": "비듬의 주요 원인인 말라세지아균의 증식을 억제한다. 비듬 샴푸에 가장 많이 사용되는 성분 중 하나로 가려움증과 비듬을 동시에 잡아준다.",
    "source": "system"
  },
  {
    "ko": "살리실산",
    "en": "Salicylic Acid",
    "cat": "두피",
    "mid": "각질제거",
    "role": "두피 각질 제거 / 모공 청소",
    "strength": "중",
    "feature": "각질 용해, 모공 세정",
    "desc": "지용성 성분으로 두피 각질 사이로 침투해 쌓인 각질을 부드럽게 녹여낸다. 두피 트러블이나 과각질로 인한 비듬 개선에 효과적이다.",
    "source": "system"
  },
  {
    "ko": "클림바졸",
    "en": "Climbazole",
    "cat": "두피",
    "mid": "항비듬",
    "role": "비듬균 억제 / 두피 균형 유지",
    "strength": "중",
    "feature": "항진균, 비듬 억제",
    "desc": "항진균 성분으로 비듬 원인균의 성장을 억제한다. 징크 피리치온보다 저자극으로 민감한 두피에도 사용 가능하며 다른 항비듬 성분과 함께 사용하면 효과가 높아진다.",
    "source": "system"
  },
  {
    "ko": "나이아신아마이드",
    "en": "Niacinamide",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 피지 조절 / 모근 강화",
    "strength": "약",
    "feature": "피지 조절, 두피 건강",
    "desc": "비타민 B3 계열로 두피의 과도한 피지 분비를 조절하고 모근 주변 혈액 순환을 도와 모발이 건강하게 자랄 환경을 만든다.",
    "source": "system"
  },
  {
    "ko": "바이오틴",
    "en": "Biotin",
    "cat": "두피",
    "mid": "두피케어",
    "role": "모발 성장 지원 / 모근 강화",
    "strength": "약",
    "feature": "모발 성장, 모근 영양",
    "desc": "비타민 B7로 모발 케라틴 생성에 관여한다. 두피에 직접 바르는 것보다 내복했을 때 효과가 더 높다는 의견이 있으나, 두피 제품에도 널리 사용된다.",
    "source": "system"
  },
  {
    "ko": "카페인",
    "en": "Caffeine",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 혈행 촉진 / 탈모 예방 보조",
    "strength": "중",
    "feature": "혈행 촉진, 모근 자극",
    "desc": "두피 혈액 순환을 자극해 모근에 영양 공급을 촉진한다. DHT(탈모 유발 호르몬)의 작용을 일부 억제하는 연구 결과가 있어 탈모 방지 제품에 많이 사용된다.",
    "source": "system"
  },
  {
    "ko": "미녹시딜",
    "en": "Minoxidil",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "모낭 자극 / 발모 촉진",
    "strength": "강",
    "feature": "발모 촉진, 모낭 활성",
    "desc": "혈관을 확장해 두피 혈행을 강하게 촉진하고 모낭을 자극해 발모를 돕는다. 의약품 성분으로 분류되며 전문적인 탈모 치료제에 사용된다. 사용 전 전문가 상담이 필요하다.",
    "source": "system"
  },
  {
    "ko": "센텔라아시아티카 추출물",
    "en": "Centella Asiatica Extract",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 진정 / 상처 회복 보조",
    "strength": "약",
    "feature": "진정, 회복",
    "desc": "병풀에서 추출한 성분으로 예민하거나 손상된 두피를 진정시키고 회복을 돕는다. 자극받은 두피의 붉음증을 줄이는 데 효과적이다.",
    "source": "system"
  },
  {
    "ko": "티 트리 오일",
    "en": "Melaleuca Alternifolia Leaf Oil",
    "cat": "두피",
    "mid": "항균",
    "role": "두피 항균 / 비듬·가려움 완화",
    "strength": "중",
    "feature": "항균, 두피 청결",
    "desc": "강한 항균, 항진균 효능을 가진 에센셜 오일이다. 비듬과 가려움의 원인이 되는 균을 억제하고 두피를 청결하게 유지한다. 원액 사용 시 자극이 강할 수 있으므로 희석 사용을 권장한다.",
    "source": "system"
  },
  {
    "ko": "피록톤 올아민",
    "en": "Piroctone Olamine",
    "cat": "두피",
    "mid": "항비듬",
    "role": "비듬균 억제 / 두피 가려움 완화",
    "strength": "중",
    "feature": "항진균, 비듬 억제",
    "desc": "징크 피리치온과 함께 비듬 샴푸에 가장 많이 쓰이는 성분이다. 비듬 원인균 억제 효과가 높으면서 피부 자극이 적은 편이라 민감한 두피에도 적합하다.",
    "source": "system"
  },
  {
    "ko": "코퍼 트리펩타이드-1",
    "en": "Copper Tripeptide-1",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "모근 강화 / 두피 회복 촉진",
    "strength": "중",
    "feature": "모근 강화, 두피 재생",
    "desc": "구리와 결합된 펩타이드 성분으로 모낭 주변 조직 회복을 돕고 모근을 강화한다. 탈모 방지 및 두피 재생 제품에 프리미엄 성분으로 활용된다.",
    "source": "system"
  },
  {
    "ko": "소듐 하이알루로네이트",
    "en": "Sodium Hyaluronate",
    "cat": "두피",
    "mid": "보습",
    "role": "두피 깊은 수분 공급",
    "strength": "약",
    "feature": "고보습, 흡수력",
    "desc": "히알루론산을 더 작게 만든 형태로 두피 깊이 흡수되어 수분을 공급한다. 건성 두피나 당김이 심한 두피를 촉촉하게 만들어준다.",
    "source": "system"
  },
  {
    "ko": "덱스판테놀",
    "en": "Dexpanthenol",
    "cat": "두피",
    "mid": "보습",
    "role": "두피 수분 유지 / 자극 완화",
    "strength": "약",
    "feature": "보습, 진정",
    "desc": "판테놀과 동일한 비타민 B5 계열로 두피에 수분을 공급하고 염증 반응을 진정시킨다. 화학 시술 후 예민해진 두피 회복에 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "소듐 피씨에이",
    "en": "Sodium PCA",
    "cat": "두피",
    "mid": "보습",
    "role": "두피 자연 보습 / 수분 손실 방지",
    "strength": "약",
    "feature": "보습, 자연 보습인자",
    "desc": "피부의 자연 보습인자(NMF)와 유사한 성분으로 두피의 수분 손실을 막는다. 건조한 환경에서도 두피가 당기거나 가려운 느낌을 줄여준다.",
    "source": "system"
  },
  {
    "ko": "올레익산",
    "en": "Oleic Acid",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 유연성 / 큐티클 침투",
    "strength": "중",
    "feature": "큐티클 침투, 유연성",
    "desc": "오메가-9 지방산으로 모발 큐티클 사이로 침투해 내부를 부드럽게 만든다. 건조하고 딱딱한 모발에 유연성을 주지만 모공을 막을 수 있어 두피에는 과도하게 사용하지 않는 게 좋다.",
    "source": "system"
  },
  {
    "ko": "리놀레익산",
    "en": "Linoleic Acid",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 피지 균형 / 모공 막힘 방지",
    "strength": "약",
    "feature": "피지 균형, 가벼운 오일",
    "desc": "오메가-6 지방산으로 두피 피지와 유사한 성분이다. 두피의 유수분 밸런스를 맞추고 모공이 막히는 것을 줄여준다.",
    "source": "system"
  },
  {
    "ko": "폴리쿼터늄-10",
    "en": "Polyquaternium-10",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 정전기 방지 / 부드러운 감촉",
    "strength": "약",
    "feature": "정전기 억제, 컨디셔닝",
    "desc": "셀룰로오스 유래 양이온 폴리머로 모발 표면에 얇게 코팅되어 정전기를 억제하고 부드러운 감촉을 만든다. 가볍고 쌓이지 않아 가는 모발에도 적합하다.",
    "source": "system"
  },
  {
    "ko": "폴리쿼터늄-11",
    "en": "Polyquaternium-11",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 코팅 / 스타일 유지",
    "strength": "중",
    "feature": "코팅, 스타일 고정",
    "desc": "모발 표면에 피막을 형성해 스타일을 유지하고 윤기를 준다. 컨디셔너와 스타일링 제품에 모두 사용되며 보습 효과도 있다.",
    "source": "system"
  },
  {
    "ko": "구아 하이드록시프로필트리모늄 클로라이드",
    "en": "Guar Hydroxypropyltrimonium Chloride",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 코팅 / 빗질 용이",
    "strength": "중",
    "feature": "컨디셔닝, 슬립감",
    "desc": "구아검에서 유래한 양이온 폴리머로 모발을 코팅해 빗질이 쉽게 되도록 만든다. 젖은 모발에서 특히 효과적이며 건조 후에도 부드러운 감촉이 남는다.",
    "source": "system"
  },
  {
    "ko": "하이드록시에틸셀룰로오스",
    "en": "Hydroxyethylcellulose",
    "cat": "세정",
    "mid": "점도조절",
    "role": "제품 점도 조절 / 질감 형성",
    "strength": "약",
    "feature": "점도 조절, 질감",
    "desc": "셀룰로오스 유래 점도 조절제로 샴푸, 컨디셔너의 제형을 안정적으로 만든다. 모발에 부드러운 감촉을 주는 효과도 있다.",
    "source": "system"
  },
  {
    "ko": "카보머",
    "en": "Carbomer",
    "cat": "세정",
    "mid": "점도조절",
    "role": "제품 겔 질감 형성",
    "strength": "약",
    "feature": "점도 조절, 제형 안정",
    "desc": "겔 타입 제품의 질감을 만드는 합성 폴리머다. 투명하고 가벼운 겔 제형을 원할 때 사용하며 보습 효과는 거의 없다.",
    "source": "system"
  },
  {
    "ko": "소듐 벤조에이트",
    "en": "Sodium Benzoate",
    "cat": "세정",
    "mid": "보존제",
    "role": "제품 변질 방지 / 유통기한 연장",
    "strength": "약",
    "feature": "방부, 변질 방지",
    "desc": "산성 환경에서 효과적인 방부제로 제품이 오염되거나 변질되는 것을 막는다. 단독 사용보다 다른 보존제와 함께 사용할 때 더 효과적이다.",
    "source": "system"
  },
  {
    "ko": "페녹시에탄올",
    "en": "Phenoxyethanol",
    "cat": "세정",
    "mid": "보존제",
    "role": "제품 보존 / 세균 억제",
    "strength": "약",
    "feature": "방부, 세균 억제",
    "desc": "파라벤을 대체하는 방부제로 광범위한 세균에 효과적이다. pH에 관계없이 작용하며 자극이 적어 민감성 제품에도 널리 사용된다.",
    "source": "system"
  },
  {
    "ko": "에틸헥실글리세린",
    "en": "Ethylhexylglycerin",
    "cat": "세정",
    "mid": "보존제",
    "role": "보존 보조 / 피부 컨디셔닝",
    "strength": "약",
    "feature": "방부 보조, 보습",
    "desc": "방부 효과와 보습 효과를 동시에 갖는 성분으로 페녹시에탄올과 함께 사용하면 보존력이 강해진다. 단독으로는 보존력이 약하다.",
    "source": "system"
  },
  {
    "ko": "포타슘 소르베이트",
    "en": "Potassium Sorbate",
    "cat": "세정",
    "mid": "보존제",
    "role": "곰팡이 및 효모 억제",
    "strength": "약",
    "feature": "방부, 곰팡이 억제",
    "desc": "천연 유래 보존제로 곰팡이와 효모의 증식을 억제한다. 단독 사용으로는 충분하지 않아 다른 보존제와 함께 사용하는 경우가 많다.",
    "source": "system"
  },
  {
    "ko": "토코페롤",
    "en": "Tocopherol",
    "cat": "크리닉",
    "mid": "항산화",
    "role": "모발·두피 산화 방지 / 제품 산패 방지",
    "strength": "약",
    "feature": "항산화, 산패 방지",
    "desc": "비타민 E 계열로 모발과 두피의 산화 스트레스를 줄이고 제품의 산패를 방지한다. 열이나 자외선으로 인한 손상을 줄이는 데 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "아스코르브산",
    "en": "Ascorbic Acid",
    "cat": "두피",
    "mid": "항산화",
    "role": "두피 항산화 / 두피 톤 균일화",
    "strength": "약",
    "feature": "항산화, 두피 밝힘",
    "desc": "비타민 C 계열로 두피의 산화 손상을 막고 두피 색소 침착을 줄이는 데 도움을 준다. 불안정해 산화되기 쉽기 때문에 밀폐 포장이나 안정화된 형태로 사용된다.",
    "source": "system"
  },
  {
    "ko": "리모넨",
    "en": "Limonene",
    "cat": "세정",
    "mid": "향료",
    "role": "향 부여 / 청량감",
    "strength": "약",
    "feature": "감귤 향, 청량감",
    "desc": "감귤류 과일에서 추출한 천연 향 성분으로 상쾌하고 가벼운 향을 준다. 일부에서 접촉성 피부염을 유발할 수 있어 민감한 피부에는 주의가 필요하다.",
    "source": "system"
  },
  {
    "ko": "라벤더 오일",
    "en": "Lavandula Angustifolia Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 진정 / 스트레스 완화 향",
    "strength": "약",
    "feature": "진정, 아로마",
    "desc": "라벤더 꽃에서 추출한 에센셜 오일로 두피를 진정시키고 항균 효과가 있다. 두피 자극을 줄이고 심리적 편안함을 주는 향으로도 활용된다.",
    "source": "system"
  },
  {
    "ko": "로즈마리 추출물",
    "en": "Rosmarinus Officinalis Leaf Extract",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "두피 혈행 촉진 / 탈모 예방 보조",
    "strength": "중",
    "feature": "혈행 촉진, 모근 자극",
    "desc": "두피 혈액 순환을 자극해 모근에 영양 공급을 돕는다. 일부 연구에서 미녹시딜과 유사한 수준의 탈모 개선 효과가 보고되어 탈모 케어 제품에 많이 사용된다.",
    "source": "system"
  },
  {
    "ko": "아데노신",
    "en": "Adenosine",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "모발 성장 촉진 / 모낭 활성화",
    "strength": "중",
    "feature": "모발 성장, 모낭 활성",
    "desc": "세포 에너지 대사에 관여하는 성분으로 모낭 세포의 활동을 촉진해 모발 성장을 돕는다. 식약처 인증 탈모 기능성 원료 중 하나다.",
    "source": "system"
  },
  {
    "ko": "덱스판테놀",
    "en": "Dexpanthenol",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 수분 유지 / 탄력",
    "strength": "약",
    "feature": "보습, 탄력",
    "desc": "판테놀과 유사한 비타민 B5 계열로 모발에 수분을 공급하고 끊어지기 쉬운 모발에 탄력과 유연성을 준다.",
    "source": "system"
  },
  {
    "ko": "베타인",
    "en": "Betaine",
    "cat": "세정",
    "mid": "보습",
    "role": "세정 중 보습 유지 / 자극 완화",
    "strength": "약",
    "feature": "보습, 자극 완화",
    "desc": "사탕무 유래 성분으로 세정 과정에서도 모발과 두피에 수분을 유지시키고 계면활성제 자극을 줄여준다.",
    "source": "system"
  },
  {
    "ko": "트레할로스",
    "en": "Trehalose",
    "cat": "크리닉",
    "mid": "보습",
    "role": "열·건조 스트레스로부터 모발 보호",
    "strength": "약",
    "feature": "보습, 열 보호",
    "desc": "설탕 계열 보습 성분으로 모발에 수분막을 형성해 고열이나 건조한 환경에서 모발이 손상되는 것을 줄여준다.",
    "source": "system"
  },
  {
    "ko": "소듐 PCA",
    "en": "Sodium PCA",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 수분 손실 방지",
    "strength": "약",
    "feature": "보습, 자연 보습인자",
    "desc": "피부와 모발의 자연 보습인자와 유사한 성분으로 수분이 빠져나가는 것을 막아 촉촉함을 유지한다.",
    "source": "system"
  },
  {
    "ko": "소듐 라우로일 메틸 이세티오네이트",
    "en": "Sodium Lauroyl Methyl Isethionate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "저자극 세정 / 부드러운 거품",
    "strength": "약",
    "feature": "저자극, 부드러운 거품",
    "desc": "코코넛 유래 저자극 계면활성제로 풍부하고 부드러운 거품을 만들면서 두피 자극은 적다. 세정 후 당김 없이 촉촉한 느낌이 유지된다.",
    "source": "system"
  },
  {
    "ko": "암모늄 라우릴 설페이트",
    "en": "Ammonium Lauryl Sulfate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "강한 세정 및 풍부한 거품",
    "strength": "강",
    "feature": "강세정, 기포",
    "desc": "SLS와 유사한 강한 음이온 계면활성제다. 풍성한 거품과 강한 세정력이 특징이며, 지성 두피나 제품 잔여물이 많은 경우에 효과적이다.",
    "source": "system"
  },
  {
    "ko": "다이소듐 코코앰포다이아세테이트",
    "en": "Disodium Cocoamphodiacetate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "민감 두피 세정 / 자극 완화",
    "strength": "약",
    "feature": "저자극, 두피 진정",
    "desc": "양쪽성 계면활성제로 강한 세정 성분의 자극을 완화하고 민감한 두피에도 사용할 수 있다. 코카미도프로필 베타인과 유사한 역할을 한다.",
    "source": "system"
  },
  {
    "ko": "스테아라미도프로필 다이메틸아민",
    "en": "Stearamidopropyl Dimethylamine",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 표면 정전기 방지 / 부드러운 빗질",
    "strength": "중",
    "feature": "정전기 억제, 빗질 용이",
    "desc": "컨디셔너에 사용되는 양이온 성분으로 모발 표면 정전기를 잡고 빗질이 부드럽게 되도록 만든다. 산성 pH에서 더 효과적으로 작용한다.",
    "source": "system"
  },
  {
    "ko": "이소프로판올",
    "en": "Isopropyl Alcohol",
    "cat": "펌제",
    "mid": "용제",
    "role": "성분 용해 보조 / 속건성",
    "strength": "중",
    "feature": "용제, 속건",
    "desc": "펌제나 염모제에서 다른 성분을 균일하게 녹이는 용제 역할을 한다. 휘발성이 있어 제품을 빠르게 건조시키지만 과도하면 두피 건조함을 유발할 수 있다.",
    "source": "system"
  },
  {
    "ko": "암모늄 바이카보네이트",
    "en": "Ammonium Bicarbonate",
    "cat": "펌제",
    "mid": "알칼리",
    "role": "pH 조절 / 큐티클 팽창 보조",
    "strength": "중",
    "feature": "pH 조절, 알칼리",
    "desc": "탄산암모늄 계열 알칼리 성분으로 펌제의 pH를 높여 큐티클을 팽창시키는 데 도움을 준다. 암모니아보다 냄새가 덜하다.",
    "source": "system"
  },
  {
    "ko": "브롬산나트륨",
    "en": "Sodium Bromate",
    "cat": "펌제",
    "mid": "산화제",
    "role": "펌 2제 / 결합 재형성",
    "strength": "중",
    "feature": "산화, 결합 재형성",
    "desc": "펌 2제로 사용되는 산화제로 1제로 풀린 모발 결합을 원하는 형태에서 다시 고정시킨다. 과산화수소보다 온화해 손상이 적지만 속도가 느리다.",
    "source": "system"
  },
  {
    "ko": "소듐 퍼설페이트",
    "en": "Sodium Persulfate",
    "cat": "염모제",
    "mid": "산화제",
    "role": "탈색 파우더 산화 / 강한 밝힘",
    "strength": "강",
    "feature": "강한 탈색, 산화",
    "desc": "탈색 파우더의 핵심 성분으로 모발 멜라닌을 빠르게 분해해 강하게 밝혀준다. 자극이 강하므로 두피 직접 접촉은 피하고 올드 테크닉이나 하이라이트 등에 활용된다.",
    "source": "system"
  },
  {
    "ko": "암모늄 퍼설페이트",
    "en": "Ammonium Persulfate",
    "cat": "염모제",
    "mid": "산화제",
    "role": "강력 탈색 / 하이라이트",
    "strength": "강",
    "feature": "강한 탈색, 기포 발생",
    "desc": "탈색 파우더에서 소듐 퍼설페이트와 함께 사용되는 강한 산화제다. 탈색력이 매우 강하며 알레르기를 일으킬 수 있어 패치 테스트가 중요하다.",
    "source": "system"
  },
  {
    "ko": "소듐 실리케이트",
    "en": "Sodium Silicate",
    "cat": "펌제",
    "mid": "알칼리",
    "role": "알칼리 유지 / 큐티클 팽창 유지",
    "strength": "중",
    "feature": "알칼리 유지, 큐티클 팽창",
    "desc": "강한 알칼리 성분으로 펌제의 pH를 높게 유지해 큐티클이 열린 상태를 지속시킨다. 성분이 강하므로 손상된 모발에는 주의가 필요하다.",
    "source": "system"
  },
  {
    "ko": "에틸렌다이아민테트라아세트산(EDTA)",
    "en": "Disodium EDTA",
    "cat": "세정",
    "mid": "킬레이트제",
    "role": "수돗물 미네랄 중화 / 세정력 유지",
    "strength": "약",
    "feature": "킬레이트, 세정 보조",
    "desc": "수돗물 속 칼슘, 마그네슘 등 미네랄 이온을 잡아 샴푸가 더 잘 거품이 나고 세정력이 유지되도록 돕는다. 비듬 방지 성분의 효과를 높이는 역할도 한다.",
    "source": "system"
  },
  {
    "ko": "레시틴",
    "en": "Lecithin",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 유화 / 보습 보조",
    "strength": "약",
    "feature": "유화, 보습",
    "desc": "대두나 달걀에서 추출한 천연 유화제로 오일과 물이 잘 섞이게 해준다. 모발에 부드러운 감촉을 주고 보습을 돕는다.",
    "source": "system"
  },
  {
    "ko": "판테틴",
    "en": "Pantethine",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 피지 조절 / 모근 강화",
    "strength": "약",
    "feature": "피지 조절, 모발 강화",
    "desc": "비타민 B5 관련 성분으로 두피의 과도한 피지를 조절하고 모발이 건강하게 자라는 환경을 만드는 데 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "타우린",
    "en": "Taurine",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "화학 시술 손상 방지 / 모발 구조 보호",
    "strength": "약",
    "feature": "손상 방지, 구조 보호",
    "desc": "아미노산 계열 성분으로 펌이나 염색 시술 시 모발 단백질이 과도하게 손상되는 것을 막아준다. 시술 전후 처리제에 많이 포함된다.",
    "source": "system"
  },
  {
    "ko": "시스틴",
    "en": "Cystine",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 결합 강화 / 손상 회복",
    "strength": "중",
    "feature": "결합 강화, 탄력",
    "desc": "모발 케라틴의 핵심 아미노산으로 모발 내 이황화 결합을 보강해 강도와 탄력을 회복시킨다. 화학 시술 후 소실된 모발 결합을 보충하는 데 효과적이다.",
    "source": "system"
  },
  {
    "ko": "아르기닌",
    "en": "Arginine",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 손상 부위 채움 / pH 조절 보조",
    "strength": "약",
    "feature": "손상 부위 채움, 보호",
    "desc": "양전하 아미노산으로 음전하를 띠는 손상 모발 부위에 결합해 빈 공간을 채운다. 알칼리 성분으로 pH를 조절하는 역할도 한다.",
    "source": "system"
  },
  {
    "ko": "글루타민산",
    "en": "Glutamic Acid",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 수분 유지 / 손상 방지",
    "strength": "약",
    "feature": "보습, 손상 방지",
    "desc": "산성 아미노산으로 모발에 수분을 끌어당겨 건조함을 방지한다. 단독보다는 다른 아미노산과 함께 복합 성분으로 사용될 때 효과적이다.",
    "source": "system"
  },
  {
    "ko": "말산",
    "en": "Malic Acid",
    "cat": "크리닉",
    "mid": "pH조절",
    "role": "시술 후 pH 낮춤 / 큐티클 닫기",
    "strength": "중",
    "feature": "pH 조절, 큐티클 수렴",
    "desc": "사과에서 유래한 유기산으로 알칼리 시술 후 높아진 pH를 낮춰 열린 큐티클을 닫아준다. 산처리제에 많이 사용된다.",
    "source": "system"
  },
  {
    "ko": "구연산",
    "en": "Citric Acid",
    "cat": "세정",
    "mid": "pH조절",
    "role": "제품 pH 조절 / 큐티클 수렴",
    "strength": "약",
    "feature": "pH 조절, 수렴",
    "desc": "레몬 등에서 유래한 유기산으로 샴푸나 컨디셔너의 pH를 낮추는 데 사용된다. 산성 환경에서 큐티클이 닫혀 윤기가 생긴다.",
    "source": "system"
  },
  {
    "ko": "젖산",
    "en": "Lactic Acid",
    "cat": "두피",
    "mid": "pH조절",
    "role": "두피 pH 균형 / 각질 부드럽게",
    "strength": "약",
    "feature": "pH 조절, 각질 완화",
    "desc": "AHA(알파하이드록시산) 계열로 두피의 pH를 약산성으로 유지하고 쌓인 각질을 부드럽게 녹인다. 두피 컨디션을 건강하게 유지하는 데 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "살리실산",
    "en": "Salicylic Acid",
    "cat": "세정",
    "mid": "각질제거",
    "role": "두피 각질 제거 / 모공 세정",
    "strength": "중",
    "feature": "각질 용해, 모공 세정",
    "desc": "BHA 계열 지용성 성분으로 두피 각질과 모공 속 이물질을 효과적으로 제거한다. 비듬이나 지성 두피 케어에 특히 효과적이다.",
    "source": "system"
  },
  {
    "ko": "하이드롤라이즈드 소이 프로틴",
    "en": "Hydrolyzed Soy Protein",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 강도 보강 / 볼륨감",
    "strength": "약",
    "feature": "단백질 보강, 볼륨",
    "desc": "대두 단백질을 분해해 만든 성분으로 모발을 코팅하고 강도를 높인다. 가늘고 힘없는 모발에 볼륨감을 주는 데 효과적이다.",
    "source": "system"
  },
  {
    "ko": "라이스 브란 오일",
    "en": "Oryza Sativa Bran Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 보습 / 가벼운 코팅",
    "strength": "약",
    "feature": "가벼운 보습, 광택",
    "desc": "쌀겨에서 추출한 오일로 가볍고 흡수가 빠르다. 모발에 끈적임 없이 보습을 주고 자연스러운 광택을 만든다.",
    "source": "system"
  },
  {
    "ko": "올리브 오일",
    "en": "Olea Europaea Fruit Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "고보습 코팅 / 건조 모발 영양",
    "strength": "중",
    "feature": "고보습, 영양",
    "desc": "올레산이 풍부해 건조하고 손상된 모발에 영양을 공급하고 부드럽게 만든다. 다소 무거운 편이어서 가는 모발에는 적게 사용하는 것이 좋다.",
    "source": "system"
  },
  {
    "ko": "마카다미아 오일",
    "en": "Macadamia Integrifolia Seed Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "두피·모발 영양 / 피지 유사 보습",
    "strength": "약",
    "feature": "영양, 흡수력",
    "desc": "팔미톨레산이 풍부해 두피 피지와 유사한 성질을 갖는다. 피부와 두피에 잘 흡수되어 끈적임 없이 영양을 준다.",
    "source": "system"
  },
  {
    "ko": "아보카도 오일",
    "en": "Persea Gratissima Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 깊은 보습 / 손상 모발 회복",
    "strength": "중",
    "feature": "고보습, 깊은 침투",
    "desc": "올레산과 비타민이 풍부해 모발 깊이 침투해 영양을 주고 건조하고 손상된 모발을 회복시킨다.",
    "source": "system"
  },
  {
    "ko": "포도씨 오일",
    "en": "Vitis Vinifera Seed Oil",
    "cat": "두피",
    "mid": "보습",
    "role": "두피 가벼운 보습 / 항산화",
    "strength": "약",
    "feature": "가벼운 보습, 항산화",
    "desc": "리놀레산이 풍부하고 가벼워 두피에 부담 없이 보습을 준다. 항산화 성분도 포함돼 두피 산화 손상을 줄이는 데 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "글리시릭애씨드",
    "en": "Glycyrrhizic Acid",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 염증 진정 / 자극 완화",
    "strength": "약",
    "feature": "진정, 항염",
    "desc": "감초에서 추출한 성분으로 두피 염증을 줄이고 예민한 두피를 진정시킨다. 자극받은 두피의 붉음증과 가려움을 완화하는 데 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "탈크",
    "en": "Talc",
    "cat": "세정",
    "mid": "흡수제",
    "role": "유분 흡수 / 드라이 샴푸 베이스",
    "strength": "약",
    "feature": "유분 흡수, 청량감",
    "desc": "드라이 샴푸의 주요 성분으로 두피의 과도한 유분을 흡수해 머리를 감은 것 같은 느낌을 준다. 입자가 고와야 두피에 잔여물이 남지 않는다.",
    "source": "system"
  },
  {
    "ko": "황토 추출물",
    "en": "Loess Extract",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 독소 흡착 / 세정 보조",
    "strength": "약",
    "feature": "흡착, 두피 청결",
    "desc": "황토에 포함된 미네랄 성분이 두피의 노폐물과 독소를 흡착해 청결하게 만든다. 두피 자극이 적고 천연 성분이라는 인식이 높다.",
    "source": "system"
  },
  {
    "ko": "당귀 추출물",
    "en": "Angelica Gigas Root Extract",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "두피 혈행 촉진 / 모근 강화",
    "strength": "약",
    "feature": "혈행 촉진, 모근 영양",
    "desc": "한방 원료인 당귀에서 추출한 성분으로 두피 혈액 순환을 돕고 모근 주변 영양 공급을 촉진한다. 한방 탈모 제품에 많이 사용된다.",
    "source": "system"
  },
  {
    "ko": "인삼 추출물",
    "en": "Panax Ginseng Root Extract",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "두피 활력 / 탈모 예방 보조",
    "strength": "약",
    "feature": "두피 활력, 모근 강화",
    "desc": "인삼의 진세노사이드 성분이 두피에 활력을 주고 모발 성장을 돕는다. 한방 탈모 케어 제품에서 대표적으로 사용되는 원료다.",
    "source": "system"
  },
  {
    "ko": "가수분해 쌀 단백질",
    "en": "Hydrolyzed Rice Protein",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 강도 보강 / 가는 모발 볼륨",
    "strength": "약",
    "feature": "단백질 보강, 볼륨",
    "desc": "쌀에서 추출한 단백질로 모발 표면에 얇게 결합해 가늘고 힘없는 모발에 탄력과 볼륨을 준다. 가볍게 코팅되어 무거워지지 않는다.",
    "source": "system"
  },
  {
    "ko": "가수분해 카제인",
    "en": "Hydrolyzed Casein",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "손상 모발 채움 / 강도 회복",
    "strength": "중",
    "feature": "손상 회복, 단백질 보강",
    "desc": "우유 단백질을 분해한 성분으로 손상된 모발 내부 빈 공간을 채우고 끊어지기 쉬운 모발의 강도를 높인다. 열 시술 전후 트리트먼트에 많이 사용된다.",
    "source": "system"
  },
  {
    "ko": "가수분해 옥수수 단백질",
    "en": "Hydrolyzed Corn Protein",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 코팅 / 광택",
    "strength": "약",
    "feature": "코팅, 윤기",
    "desc": "옥수수 단백질을 분해해 모발 표면에 코팅막을 만든다. 건조한 모발에 자연스러운 윤기를 주며 밀 단백질에 알레르기가 있는 경우의 대체 성분으로 활용된다.",
    "source": "system"
  },
  {
    "ko": "가수분해 퀴노아 단백질",
    "en": "Hydrolyzed Quinoa Protein",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "손상 모발 회복 / 큐티클 보호",
    "strength": "약",
    "feature": "큐티클 보호, 손상 회복",
    "desc": "슈퍼푸드 퀴노아에서 추출한 단백질로 모발 큐티클 층에 결합해 손상을 방지하고 손상된 모발을 회복시킨다. 화학 시술 후 처리제로 적합하다.",
    "source": "system"
  },
  {
    "ko": "가수분해 루핀 단백질",
    "en": "Hydrolyzed Lupine Protein",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 탄력 / 볼륨감 부여",
    "strength": "약",
    "feature": "탄력, 볼륨",
    "desc": "루핀 콩에서 추출한 식물성 단백질로 모발에 탄력과 볼륨감을 준다. 비건 제품에 동물성 단백질 대신 사용되는 성분이다.",
    "source": "system"
  },
  {
    "ko": "가수분해 완두 단백질",
    "en": "Hydrolyzed Pea Protein",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 강화 / 손상 방지",
    "strength": "약",
    "feature": "식물성 단백질, 강화",
    "desc": "완두에서 추출한 식물성 단백질로 모발을 코팅하고 외부 자극으로부터 보호한다. 비건 제품에서 케라틴을 대신해 사용하는 경우가 많다.",
    "source": "system"
  },
  {
    "ko": "아미노산 복합체",
    "en": "Amino Acids",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "손상 모발 종합 케어 / 수분·강도 동시 개선",
    "strength": "중",
    "feature": "복합 케어, 모발 건강",
    "desc": "여러 아미노산을 혼합한 성분으로 모발의 수분을 잡아두면서 동시에 강도를 높인다. 단일 아미노산보다 다양한 모발 손상에 전반적으로 효과를 낸다.",
    "source": "system"
  },
  {
    "ko": "가수분해 엘라스틴",
    "en": "Hydrolyzed Elastin",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 탄력 회복 / 유연성",
    "strength": "약",
    "feature": "탄력, 유연성",
    "desc": "엘라스틴 단백질을 분해한 성분으로 화학 시술로 탄력을 잃은 모발에 유연성을 되돌려준다. 사용 후 모발이 끊어지지 않고 부드럽게 휘는 느낌이 생긴다.",
    "source": "system"
  },
  {
    "ko": "모발 유래 케라틴",
    "en": "Keratin",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 구조 직접 보강 / 강한 손상 회복",
    "strength": "강",
    "feature": "강한 보강, 손상 회복",
    "desc": "모발과 동일한 케라틴 단백질로 손상이 심한 모발 내부를 강하게 채워준다. 가수분해 케라틴보다 분자가 커서 표면 보강에 더 집중된다.",
    "source": "system"
  },
  {
    "ko": "실크 아미노산",
    "en": "Silk Amino Acids",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 광택 / 부드러운 표면 형성",
    "strength": "약",
    "feature": "실키감, 광택",
    "desc": "실크 단백질에서 분리한 아미노산으로 모발 표면을 매끄럽게 만들어 눈에 보이는 광택을 준다. 가수분해 실크보다 더 작은 입자로 모발 속까지 일부 침투한다.",
    "source": "system"
  },
  {
    "ko": "밍크 오일",
    "en": "Mink Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 고보습 / 부드러운 코팅",
    "strength": "중",
    "feature": "고보습, 윤기",
    "desc": "밍크에서 추출한 오일로 모발과 유사한 지방산 구조를 가져 흡수가 빠르다. 건조하고 거친 모발을 부드럽게 만들고 자연스러운 광택을 준다.",
    "source": "system"
  },
  {
    "ko": "에뮤 오일",
    "en": "Emu Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "두피·모발 영양 / 깊은 침투",
    "strength": "중",
    "feature": "깊은 침투, 영양",
    "desc": "에뮤 새에서 추출한 오일로 피부 침투력이 높다. 두피와 모발 깊이 흡수되어 건조함을 개선하고 모근 주변 영양 공급을 돕는다.",
    "source": "system"
  },
  {
    "ko": "스쿠알란",
    "en": "Squalane",
    "cat": "크리닉",
    "mid": "보습",
    "role": "가벼운 모발 보호 / 수분 증발 차단",
    "strength": "약",
    "feature": "가벼운 보습, 산화 안정성",
    "desc": "올리브나 사탕수수에서 유래한 가벼운 오일로 모발 표면에 얇은 막을 형성해 수분이 빠져나가는 것을 막는다. 끈적임이 없어 가는 모발에도 적합하다.",
    "source": "system"
  },
  {
    "ko": "로즈힙 오일",
    "en": "Rosa Canina Fruit Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 손상 회복 보조 / 영양",
    "strength": "중",
    "feature": "손상 회복, 비타민",
    "desc": "장미 열매에서 추출한 오일로 리놀레산과 비타민 A가 풍부하다. 화학 시술로 손상된 모발에 영양을 주고 회복을 돕는다.",
    "source": "system"
  },
  {
    "ko": "달맞이꽃 오일",
    "en": "Oenothera Biennis Oil",
    "cat": "두피",
    "mid": "보습",
    "role": "두피 민감성 완화 / 피지 균형",
    "strength": "약",
    "feature": "진정, 피지 균형",
    "desc": "감마리놀렌산이 풍부한 오일로 민감하거나 건조한 두피를 진정시키고 피지 균형을 맞춘다. 아토피성 두피나 예민한 피부에 적합하다.",
    "source": "system"
  },
  {
    "ko": "블랙커런트 씨드 오일",
    "en": "Ribes Nigrum Seed Oil",
    "cat": "두피",
    "mid": "보습",
    "role": "두피 항산화 / 영양 공급",
    "strength": "약",
    "feature": "항산화, 영양",
    "desc": "블랙커런트 씨앗에서 추출한 오일로 감마리놀렌산과 알파리놀렌산이 풍부하다. 두피의 산화 손상을 줄이고 영양을 공급한다.",
    "source": "system"
  },
  {
    "ko": "카스터 오일",
    "en": "Ricinus Communis Seed Oil",
    "cat": "두피",
    "mid": "보습",
    "role": "두피 보습 / 모발 성장 보조",
    "strength": "중",
    "feature": "고보습, 리시놀레산",
    "desc": "피마자에서 추출한 오일로 리시놀레산이 풍부해 두피 혈행을 자극하고 모발이 자랄 환경을 만든다. 점성이 높아 다른 오일과 희석해 사용하는 경우가 많다.",
    "source": "system"
  },
  {
    "ko": "스위트 아몬드 오일",
    "en": "Prunus Amygdalus Dulcis Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 부드러움 / 가벼운 영양",
    "strength": "약",
    "feature": "가벼운 보습, 부드러움",
    "desc": "달콤한 아몬드에서 추출한 가벼운 오일로 모발을 부드럽게 만들고 끊어짐을 줄인다. 가는 모발에도 무겁지 않게 영양을 준다.",
    "source": "system"
  },
  {
    "ko": "살구씨 오일",
    "en": "Prunus Armeniaca Kernel Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 광택 / 가벼운 코팅",
    "strength": "약",
    "feature": "광택, 가벼운 코팅",
    "desc": "살구씨에서 추출한 가벼운 오일로 모발에 자연스러운 광택을 주고 부드럽게 코팅한다. 호호바 오일과 유사한 가벼운 질감으로 모발이 무거워지지 않는다.",
    "source": "system"
  },
  {
    "ko": "바오밥 오일",
    "en": "Adansonia Digitata Seed Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "고보습 / 손상 모발 집중 케어",
    "strength": "중",
    "feature": "고보습, 손상 회복",
    "desc": "아프리카 바오밥 나무에서 추출한 오일로 올레산·리놀레산·리놀렌산을 모두 함유한다. 건조하고 손상된 모발을 집중적으로 보습하고 부드럽게 만든다.",
    "source": "system"
  },
  {
    "ko": "버진 코코넛 오일",
    "en": "Cocos Nucifera Virgin Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 내부 침투 보습 / 단백질 손실 방지",
    "strength": "강",
    "feature": "내부 침투, 단백질 보호",
    "desc": "정제하지 않은 코코넛 오일로 모발 내부까지 침투해 단백질이 빠져나가는 것을 막는다. 일반 코코넛 오일보다 더 풍부한 영양 성분을 갖고 있다.",
    "source": "system"
  },
  {
    "ko": "씨 버크손 오일",
    "en": "Hippophae Rhamnoides Fruit Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 재생 / 항산화 영양",
    "strength": "중",
    "feature": "재생, 항산화",
    "desc": "비타민 C와 E가 매우 풍부한 오렌지색 오일로 손상된 두피 재생을 돕고 항산화 효과를 낸다. 원액은 색이 강하므로 희석해 사용하는 게 일반적이다.",
    "source": "system"
  },
  {
    "ko": "파슬리 씨드 오일",
    "en": "Petroselinum Sativum Seed Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 혈행 촉진 / 모발 성장 보조",
    "strength": "약",
    "feature": "혈행 촉진, 모발 성장",
    "desc": "파슬리 씨앗에서 추출한 에센셜 오일로 두피 혈행을 자극해 모근에 영양 공급을 돕는다. 모발 성장 촉진 목적의 두피 세럼에 자주 활용된다.",
    "source": "system"
  },
  {
    "ko": "아마씨 오일",
    "en": "Linum Usitatissimum Seed Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 유연성 / 컬 정의",
    "strength": "약",
    "feature": "유연성, 컬 강화",
    "desc": "알파리놀렌산이 풍부한 오일로 컬이나 웨이브 모발에 유연성을 주고 컬의 형태를 선명하게 만든다. 플렉시블한 코팅막을 형성한다.",
    "source": "system"
  },
  {
    "ko": "모링가 오일",
    "en": "Moringa Oleifera Seed Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 정화 보습 / 환경 오염 차단",
    "strength": "약",
    "feature": "정화, 보습",
    "desc": "모링가 씨앗에서 추출한 오일로 공기 중 오염물질을 흡착하는 능력이 있다. 모발에 보습막을 형성하면서 환경 오염으로부터 모발을 보호한다.",
    "source": "system"
  },
  {
    "ko": "마루라 오일",
    "en": "Sclerocarya Birrea Seed Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 영양 / 빠른 흡수",
    "strength": "약",
    "feature": "빠른 흡수, 영양",
    "desc": "아프리카 마루라 나무에서 추출한 오일로 흡수가 빠르고 끈적임이 없다. 건조한 모발에 영양을 주면서도 가볍게 마무리된다.",
    "source": "system"
  },
  {
    "ko": "로즈 오일",
    "en": "Rosa Damascena Flower Oil",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 영양 / 향 부여",
    "strength": "약",
    "feature": "영양, 고급 향",
    "desc": "다마스크 장미에서 추출한 고급 에센셜 오일로 모발에 영양을 주고 우아한 향을 남긴다. 고급 헤어 오일 제품에 소량 사용된다.",
    "source": "system"
  },
  {
    "ko": "몰약 추출물",
    "en": "Commiphora Myrrha Extract",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 항염 / 두피 밸런스 유지",
    "strength": "약",
    "feature": "항염, 밸런스",
    "desc": "몰약 나무에서 추출한 성분으로 두피 염증을 줄이고 두피 환경을 건강하게 유지한다. 예민하거나 붉어진 두피에 진정 효과를 준다.",
    "source": "system"
  },
  {
    "ko": "유칼립투스 오일",
    "en": "Eucalyptus Globulus Leaf Oil",
    "cat": "두피",
    "mid": "항균",
    "role": "두피 청량감 / 항균 세정",
    "strength": "중",
    "feature": "청량감, 항균",
    "desc": "유칼립투스 잎에서 추출한 에센셜 오일로 두피에 시원한 청량감을 주고 항균 효과를 낸다. 지성 두피나 두피 냄새 관리에 효과적이다.",
    "source": "system"
  },
  {
    "ko": "페퍼민트 오일",
    "en": "Mentha Piperita Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 혈행 자극 / 청량감",
    "strength": "중",
    "feature": "혈행 촉진, 청량감",
    "desc": "페퍼민트에서 추출한 오일로 두피에 강한 청량감을 주고 혈행을 자극한다. 모근을 활성화해 모발 성장을 돕는 효과가 연구되고 있다.",
    "source": "system"
  },
  {
    "ko": "클라리 세이지 오일",
    "en": "Salvia Sclarea Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 피지 조절 / 호르몬 균형 보조",
    "strength": "약",
    "feature": "피지 조절, 밸런스",
    "desc": "클라리 세이지에서 추출한 오일로 두피 피지 분비를 조절하는 데 도움을 준다. 호르몬성 탈모나 지성 두피 관리 제품에 활용된다.",
    "source": "system"
  },
  {
    "ko": "일랑일랑 오일",
    "en": "Cananga Odorata Flower Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 피지 균형 / 향",
    "strength": "약",
    "feature": "피지 균형, 향",
    "desc": "일랑일랑 꽃에서 추출한 오일로 두피의 유분 분비를 조절하고 모발에 윤기를 준다. 독특한 플로럴 향이 특징이다.",
    "source": "system"
  },
  {
    "ko": "시더우드 오일",
    "en": "Cedrus Atlantica Bark Oil",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "두피 혈행 촉진 / 탈모 개선 보조",
    "strength": "약",
    "feature": "혈행 촉진, 탈모 개선",
    "desc": "아틀라스 삼나무에서 추출한 오일로 두피 혈액 순환을 자극해 모근에 영양 공급을 돕는다. 탈모 방지 아로마 블렌드에 자주 사용되는 성분이다.",
    "source": "system"
  },
  {
    "ko": "제라늄 오일",
    "en": "Pelargonium Graveolens Flower Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 피지 균형 / 두피 건강 유지",
    "strength": "약",
    "feature": "피지 균형, 건강 유지",
    "desc": "제라늄 꽃에서 추출한 오일로 건성과 지성 모두에 두피 피지 균형을 맞추는 데 도움을 준다. 순한 향과 함께 두피를 안정시킨다.",
    "source": "system"
  },
  {
    "ko": "주니퍼베리 오일",
    "en": "Juniperus Communis Fruit Oil",
    "cat": "두피",
    "mid": "항균",
    "role": "두피 항균 / 비듬 억제",
    "strength": "중",
    "feature": "항균, 비듬 억제",
    "desc": "향나무 열매에서 추출한 오일로 두피 항균 효과와 비듬을 유발하는 균 억제에 도움을 준다. 시원하고 상쾌한 향이 특징이다.",
    "source": "system"
  },
  {
    "ko": "시나몬 껍질 오일",
    "en": "Cinnamomum Zeylanicum Bark Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 혈행 촉진 / 모근 자극",
    "strength": "강",
    "feature": "강한 혈행 촉진",
    "desc": "계피 껍질에서 추출한 오일로 강한 혈행 촉진 효과가 있다. 두피 혈액 순환을 강하게 자극하지만 원액은 자극이 매우 강하므로 반드시 희석해 사용해야 한다.",
    "source": "system"
  },
  {
    "ko": "프랑킨센스 오일",
    "en": "Boswellia Carterii Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 재생 / 노화 방지",
    "strength": "약",
    "feature": "재생, 항산화",
    "desc": "유향 나무에서 추출한 오일로 세포 재생을 돕고 두피 노화를 늦추는 효과가 있다. 두피 트리트먼트 오일에 고급 성분으로 사용된다.",
    "source": "system"
  },
  {
    "ko": "베티버 오일",
    "en": "Vetiveria Zizanoides Root Oil",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 진정 / 수렴 효과",
    "strength": "약",
    "feature": "진정, 수렴",
    "desc": "베티버 뿌리에서 추출한 오일로 자극받은 두피를 진정시키고 모공을 수렴하는 효과가 있다. 화학 시술 후 예민해진 두피 관리에 활용된다.",
    "source": "system"
  },
  {
    "ko": "포타슘 코코일 글리시네이트",
    "en": "Potassium Cocoyl Glycinate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "순한 세정 / 아미노산 계면활성제",
    "strength": "약",
    "feature": "저자극, 아미노산 유래",
    "desc": "코코넛과 아미노산에서 만든 순한 계면활성제로 세정 후 모발과 두피가 당기지 않는다. 고급 아미노산 샴푸의 베이스로 자주 사용된다.",
    "source": "system"
  },
  {
    "ko": "소듐 코코일 글리시네이트",
    "en": "Sodium Cocoyl Glycinate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "아미노산 순한 세정 / 두피 친화적",
    "strength": "약",
    "feature": "저자극, 부드러운 세정",
    "desc": "코코넛 유래 아미노산 계면활성제로 두피와 모발에 순하게 작용한다. 세정 후 피부 pH를 크게 변화시키지 않아 민감 두피에 적합하다.",
    "source": "system"
  },
  {
    "ko": "소듐 라우로일 사르코시네이트",
    "en": "Sodium Lauroyl Sarcosinate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "순한 세정 / 컨디셔닝 보조",
    "strength": "약",
    "feature": "저자극, 컨디셔닝",
    "desc": "아미노산 계열 계면활성제로 세정력이 가볍고 모발에 부드러운 감촉을 남긴다. 샴푸와 클렌징 제품에서 SLS의 자극을 줄이는 데 함께 사용된다.",
    "source": "system"
  },
  {
    "ko": "올리브 유래 계면활성제",
    "en": "Sodium Olivate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "천연 유래 세정 / 피부 친화",
    "strength": "약",
    "feature": "천연 유래, 피부 친화",
    "desc": "올리브 오일에서 만든 비누 계열 계면활성제로 순하고 피부 친화적인 세정력을 가진다. 천연 세정 제품이나 비건 샴푸 바에 주로 활용된다.",
    "source": "system"
  },
  {
    "ko": "리시놀레아미도프로필 베타인",
    "en": "Ricinoleamidopropyl Betaine",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "피마자 유래 순한 세정 / 기포 안정",
    "strength": "약",
    "feature": "저자극, 거품 안정",
    "desc": "피마자 오일에서 유래한 양쪽성 계면활성제로 거품을 풍부하고 안정적으로 만들어준다. 민감한 두피에도 사용할 수 있을 만큼 순하다.",
    "source": "system"
  },
  {
    "ko": "라우릴 글루코사이드",
    "en": "Lauryl Glucoside",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "식물 유래 저자극 세정",
    "strength": "약",
    "feature": "천연 유래, 저자극",
    "desc": "코코넛과 포도당에서 만든 계면활성제로 코코글루코사이드와 유사하지만 더 강한 세정력을 가진다. 자연주의 제품의 주세정 성분으로 활용된다.",
    "source": "system"
  },
  {
    "ko": "세테아릴 알코올",
    "en": "Cetearyl Alcohol",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 코팅 / 크리미한 질감 형성",
    "strength": "약",
    "feature": "유연제, 코팅",
    "desc": "세틸 알코올과 스테아릴 알코올의 혼합물로 모발에 부드러운 코팅막을 형성한다. 컨디셔너의 크리미한 질감을 만드는 데 핵심 역할을 한다.",
    "source": "system"
  },
  {
    "ko": "베헨알코올",
    "en": "Behenyl Alcohol",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "무거운 코팅 / 손상 모발 정돈",
    "strength": "중",
    "feature": "코팅, 손상 정돈",
    "desc": "22개 탄소 사슬의 지방 알코올로 다른 지방 알코올보다 무거운 코팅막을 형성한다. 심하게 손상되어 부스스한 모발을 눌러 정돈하는 효과가 있다.",
    "source": "system"
  },
  {
    "ko": "폴리쿼터늄-7",
    "en": "Polyquaternium-7",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 코팅 / 정전기 방지",
    "strength": "중",
    "feature": "코팅, 정전기 억제",
    "desc": "양이온 폴리머로 모발 표면에 코팅막을 만들어 정전기를 잡고 빗질을 쉽게 한다. 린스오프 제품보다 리브온 제품에서 더 지속적인 효과를 낸다.",
    "source": "system"
  },
  {
    "ko": "폴리쿼터늄-47",
    "en": "Polyquaternium-47",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 컨디셔닝 / 보습 코팅",
    "strength": "약",
    "feature": "컨디셔닝, 보습",
    "desc": "보습 효과를 가진 양이온 폴리머로 모발 표면을 코팅하면서 수분도 잡아준다. 컨디셔닝과 보습 기능을 동시에 원하는 제품에 사용된다.",
    "source": "system"
  },
  {
    "ko": "폴리쿼터늄-44",
    "en": "Polyquaternium-44",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "리브온 컨디셔닝 / 지속력 있는 코팅",
    "strength": "중",
    "feature": "지속 코팅, 리브온",
    "desc": "세정 후에도 모발 표면에 오래 남아 컨디셔닝 효과를 지속한다. 헤어 세럼이나 리브온 트리트먼트에 코팅 지속력을 높이는 용도로 사용된다.",
    "source": "system"
  },
  {
    "ko": "아모디메티콘",
    "en": "Amodimethicone",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "손상 모발 선택 코팅 / 집중 수복",
    "strength": "중",
    "feature": "선택 코팅, 손상 집중",
    "desc": "아미노기가 결합된 실리콘으로 손상된 부위에만 선택적으로 달라붙어 코팅한다. 정상 모발보다 손상 모발에 더 많이 쌓이는 특성 덕분에 집중 케어 효과가 높다.",
    "source": "system"
  },
  {
    "ko": "페닐 트리메티콘",
    "en": "Phenyl Trimethicone",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "고광택 코팅 / 열 보호",
    "strength": "중",
    "feature": "고광택, 열 보호",
    "desc": "다이메티콘보다 굴절률이 높아 더욱 강한 광택을 만드는 실리콘 성분이다. 고데기나 드라이어 열을 차단하는 효과도 있어 열 시술 전 사용에 적합하다.",
    "source": "system"
  },
  {
    "ko": "사이클로펜타실록산",
    "en": "Cyclopentasiloxane",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "가벼운 실리콘 코팅 / 퍼짐성",
    "strength": "약",
    "feature": "가벼운 코팅, 휘발성",
    "desc": "가볍고 휘발성이 있는 실리콘으로 도포 시 퍼짐이 좋고 건조 후 잔여감이 거의 없다. 무거운 실리콘의 단점 없이 가볍게 코팅막을 형성한다.",
    "source": "system"
  },
  {
    "ko": "트리에틸헥사노인",
    "en": "Triethylhexanoin",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 유연성 / 가벼운 보습",
    "strength": "약",
    "feature": "유연성, 가벼운 보습",
    "desc": "합성 지방산 에스터로 오일보다 가볍고 끈적임 없이 모발에 부드러운 감촉을 준다. 다양한 오일 성분의 발림성을 높이는 데도 사용된다.",
    "source": "system"
  },
  {
    "ko": "이소헥사데칸",
    "en": "Isohexadecane",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "가벼운 코팅 / 빠른 흡수",
    "strength": "약",
    "feature": "가벼운 코팅, 빠른 흡수",
    "desc": "합성 탄화수소로 오일과 유사하지만 훨씬 가볍고 빠르게 흡수된다. 가볍고 촉촉한 마무리감이 필요한 리브온 제품에 활용된다.",
    "source": "system"
  },
  {
    "ko": "프로필렌 글리콜",
    "en": "Propylene Glycol",
    "cat": "세정",
    "mid": "보습",
    "role": "제품 보습 / 성분 침투 보조",
    "strength": "약",
    "feature": "보습, 침투 보조",
    "desc": "수분을 끌어당기고 제품 안의 다른 성분이 더 잘 흡수되도록 돕는다. 제품의 질감을 만들고 안정성을 높이는 역할도 한다.",
    "source": "system"
  },
  {
    "ko": "부틸렌 글리콜",
    "en": "Butylene Glycol",
    "cat": "세정",
    "mid": "보습",
    "role": "보습 / 성분 전달 보조",
    "strength": "약",
    "feature": "보습, 안정성",
    "desc": "프로필렌 글리콜보다 자극이 적은 보습제로 수분을 잡아두고 다른 성분이 피부에 잘 흡수되도록 돕는다. 두피 세럼과 트리트먼트에 많이 사용된다.",
    "source": "system"
  },
  {
    "ko": "펜틸렌 글리콜",
    "en": "Pentylene Glycol",
    "cat": "세정",
    "mid": "보습",
    "role": "보습 / 방부 보조",
    "strength": "약",
    "feature": "보습, 방부 보조",
    "desc": "보습 효과와 함께 방부 보조 기능을 가진 성분이다. 부틸렌 글리콜과 유사하게 사용되며 자극이 적어 민감성 제품에도 활용된다.",
    "source": "system"
  },
  {
    "ko": "1,2-헥산다이올",
    "en": "1,2-Hexanediol",
    "cat": "세정",
    "mid": "보존제",
    "role": "방부 보조 / 보습",
    "strength": "약",
    "feature": "방부 보조, 보습",
    "desc": "보습 효과와 방부 보조 효과를 동시에 가지는 성분이다. 페녹시에탄올과 함께 사용하면 보존 효과가 높아진다.",
    "source": "system"
  },
  {
    "ko": "에탄올",
    "en": "Alcohol Denat.",
    "cat": "세정",
    "mid": "용제",
    "role": "빠른 건조 / 성분 용해",
    "strength": "중",
    "feature": "속건, 살균",
    "desc": "변성 알코올로 두피에 바르면 빠르게 증발해 청량감을 준다. 성분을 균일하게 녹이는 용제 역할도 하지만 과도하게 사용하면 두피 건조함을 유발할 수 있다.",
    "source": "system"
  },
  {
    "ko": "글리세릴 스테아레이트",
    "en": "Glyceryl Stearate",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "오일-물 유화 / 크림 질감",
    "strength": "약",
    "feature": "유화, 제형 안정",
    "desc": "글리세린과 스테아린산이 결합한 유화제로 오일과 물을 균일하게 섞이게 만든다. 컨디셔너나 트리트먼트 크림의 질감을 안정적으로 유지하는 데 사용된다.",
    "source": "system"
  },
  {
    "ko": "PEG-7 글리세릴 코코에이트",
    "en": "PEG-7 Glyceryl Cocoate",
    "cat": "세정",
    "mid": "계면활성제",
    "role": "세정 후 촉촉한 느낌 / 컨디셔닝 세정",
    "strength": "약",
    "feature": "컨디셔닝 세정, 촉촉함",
    "desc": "코코넛 오일과 PEG가 결합한 성분으로 세정력과 컨디셔닝 효과를 동시에 가진다. 샴푸 사용 후에도 모발이 당기거나 뻑뻑하지 않은 제품에 활용된다.",
    "source": "system"
  },
  {
    "ko": "다이메티콘올",
    "en": "Dimethiconol",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 표면 고광택 코팅",
    "strength": "중",
    "feature": "고광택, 매끄러움",
    "desc": "고분자 실리콘의 일종으로 모발 표면에 강한 광택 코팅막을 만든다. 광고에서 자주 나오는 매끄럽고 빛나는 모발 연출에 핵심적인 역할을 한다.",
    "source": "system"
  },
  {
    "ko": "스테아라민 옥사이드",
    "en": "Stearamine Oxide",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "컨디셔닝 / 점도 조절",
    "strength": "약",
    "feature": "컨디셔닝, 점도",
    "desc": "모발에 부드러운 감촉을 주는 양쪽성 성분으로 컨디셔너의 점도를 조절하고 사용감을 개선한다.",
    "source": "system"
  },
  {
    "ko": "세트리모늄 브로마이드",
    "en": "Cetrimonium Bromide",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "정전기 방지 / 항균",
    "strength": "중",
    "feature": "정전기 억제, 항균",
    "desc": "양이온 계면활성제로 모발 정전기를 잡아주고 동시에 항균 효과를 낸다. 클로라이드형보다 효능이 강한 편이어서 더 낮은 농도로 사용된다.",
    "source": "system"
  },
  {
    "ko": "라우르디모늄 하이드록시프로필 가수분해 케라틴",
    "en": "Laurdimonium Hydroxypropyl Hydrolyzed Keratin",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "손상 모발 코팅 강화 / 결합 보강",
    "strength": "중",
    "feature": "케라틴 강화, 손상 집중",
    "desc": "케라틴에 양이온을 붙인 성분으로 손상 모발에 강하게 결합해 코팅과 단백질 보강 효과를 동시에 낸다. 일반 가수분해 케라틴보다 모발 흡착력이 높다.",
    "source": "system"
  },
  {
    "ko": "하이드록시프로필 트리모늄 가수분해 밀 단백질",
    "en": "Hydroxypropyltrimonium Hydrolyzed Wheat Protein",
    "cat": "크리닉",
    "mid": "단백질",
    "role": "모발 강화 코팅 / 빗질 용이",
    "strength": "약",
    "feature": "코팅, 빗질 용이",
    "desc": "밀 단백질에 양이온을 붙인 성분으로 손상 모발에 잘 달라붙어 강화 코팅 효과를 낸다. 젖은 모발에서도 빗질이 쉽게 되도록 만든다.",
    "source": "system"
  },
  {
    "ko": "피리독신 HCl",
    "en": "Pyridoxine HCl",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 세포 대사 활성 / 비듬 완화",
    "strength": "약",
    "feature": "세포 활성, 비듬 완화",
    "desc": "비타민 B6 계열로 두피 세포 대사를 활성화하고 비듬을 유발하는 과각질화를 줄이는 데 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "이노시톨",
    "en": "Inositol",
    "cat": "두피",
    "mid": "두피케어",
    "role": "모발 성장 촉진 / 두피 영양",
    "strength": "약",
    "feature": "모발 성장, 두피 영양",
    "desc": "비타민 B군 유사 성분으로 모낭 세포에 영양을 공급하고 모발 성장을 돕는다. 탈모 방지 샴푸와 두피 앰플에 많이 사용된다.",
    "source": "system"
  },
  {
    "ko": "알파-아르부틴",
    "en": "Alpha-Arbutin",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 색소 침착 완화",
    "strength": "약",
    "feature": "미백 보조, 색소 억제",
    "desc": "두피 색소 침착이나 얼룩을 줄이는 데 도움을 주는 성분이다. 두피 미백이나 색소 침착 개선을 목적으로 하는 두피 세럼에 활용된다.",
    "source": "system"
  },
  {
    "ko": "레티놀",
    "en": "Retinol",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 세포 재생 / 노화 방지",
    "strength": "중",
    "feature": "세포 재생, 노화 방지",
    "desc": "비타민 A 계열로 두피 세포 재생을 촉진하고 노화로 인한 두피 활력 저하를 개선한다. 불안정한 성분이므로 빛과 공기를 차단한 포장이 필요하다.",
    "source": "system"
  },
  {
    "ko": "에피갈로카테킨 갈레이트",
    "en": "Epigallocatechin Gallate",
    "cat": "두피",
    "mid": "항산화",
    "role": "두피 항산화 / 탈모 예방 보조",
    "strength": "중",
    "feature": "항산화, 탈모 예방",
    "desc": "녹차의 주요 항산화 성분인 EGCG로 두피의 산화 스트레스를 줄이고 탈모를 유발하는 DHT 생성을 억제하는 연구 결과가 있다.",
    "source": "system"
  },
  {
    "ko": "녹차 추출물",
    "en": "Camellia Sinensis Leaf Extract",
    "cat": "두피",
    "mid": "항산화",
    "role": "두피 항산화 / 두피 진정",
    "strength": "약",
    "feature": "항산화, 진정",
    "desc": "녹차 잎에서 추출한 성분으로 풍부한 폴리페놀이 두피 항산화 효과를 낸다. 자극받은 두피를 진정시키고 환경 오염으로부터 두피를 보호한다.",
    "source": "system"
  },
  {
    "ko": "포도 씨 추출물",
    "en": "Vitis Vinifera Seed Extract",
    "cat": "두피",
    "mid": "항산화",
    "role": "두피 항산화 / 혈행 촉진",
    "strength": "약",
    "feature": "항산화, 혈행 촉진",
    "desc": "포도씨의 프로안토시아니딘 성분이 강한 항산화 효과를 내고 두피 혈액 순환을 돕는다. 모발 성장에 필요한 환경을 만드는 데 기여한다.",
    "source": "system"
  },
  {
    "ko": "레스베라트롤",
    "en": "Resveratrol",
    "cat": "두피",
    "mid": "항산화",
    "role": "두피 노화 방지 / 모낭 보호",
    "strength": "약",
    "feature": "항산화, 노화 방지",
    "desc": "포도껍질 등에서 발견되는 강력한 항산화 성분으로 두피 세포 노화를 늦추고 모낭이 손상되는 것을 보호한다.",
    "source": "system"
  },
  {
    "ko": "퀘르세틴",
    "en": "Quercetin",
    "cat": "두피",
    "mid": "항산화",
    "role": "두피 항염 / 항산화",
    "strength": "약",
    "feature": "항염, 항산화",
    "desc": "양파 등 식물에서 추출한 플라보노이드 항산화 성분으로 두피 염증을 줄이고 산화 스트레스를 억제한다.",
    "source": "system"
  },
  {
    "ko": "쿠르쿠민",
    "en": "Curcumin",
    "cat": "두피",
    "mid": "항염",
    "role": "두피 항염 / 두피 자극 완화",
    "strength": "약",
    "feature": "항염, 진정",
    "desc": "강황에서 추출한 황색 색소 성분으로 두피 염증을 억제하고 자극받은 두피를 진정시킨다. 노란 색이 강해 사용 농도를 조절해야 한다.",
    "source": "system"
  },
  {
    "ko": "비사볼롤",
    "en": "Bisabolol",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 진정 / 피부 민감성 완화",
    "strength": "약",
    "feature": "진정, 항자극",
    "desc": "카모마일에서 추출한 성분으로 자극받거나 예민한 두피를 진정시키는 효과가 높다. 화학 시술 후 민감해진 두피에 빠른 진정 효과를 준다.",
    "source": "system"
  },
  {
    "ko": "알란토인",
    "en": "Allantoin",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 진정 / 각질 연화",
    "strength": "약",
    "feature": "진정, 각질 연화",
    "desc": "컴프리 식물에서 유래한 성분으로 두피를 진정시키고 굳어진 각질을 부드럽게 만들어 쉽게 제거되도록 돕는다. 자극이 거의 없어 예민한 두피에도 안전하다.",
    "source": "system"
  },
  {
    "ko": "판토락톤",
    "en": "Pantolactone",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 수분 유지 / 손상 방지",
    "strength": "약",
    "feature": "보습, 손상 방지",
    "desc": "판테놀 관련 성분으로 모발에 수분을 공급하고 외부 자극으로부터 모발이 손상되는 것을 줄인다.",
    "source": "system"
  },
  {
    "ko": "포스파티딜콜린",
    "en": "Phosphatidylcholine",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 지질 보충 / 큐티클 재생",
    "strength": "약",
    "feature": "지질 보충, 큐티클 재생",
    "desc": "세포막 구성 성분과 유사한 지질 성분으로 화학 시술로 손실된 모발 지질을 보충한다. 큐티클 사이를 채워 모발 광택과 보습을 회복시킨다.",
    "source": "system"
  },
  {
    "ko": "스핑고신",
    "en": "Sphingosine",
    "cat": "크리닉",
    "mid": "보습",
    "role": "모발 표면 지질층 형성 / 수분 차단막",
    "strength": "약",
    "feature": "지질층 형성, 보습",
    "desc": "모발 표면 지질층과 유사한 성분으로 손실된 지질층을 보충해 수분이 증발하지 않도록 차단한다. 화학 시술 후 큐티클 정돈에 효과적이다.",
    "source": "system"
  },
  {
    "ko": "피토스핑고신",
    "en": "Phytosphingosine",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 항균 / 장벽 기능 강화",
    "strength": "약",
    "feature": "항균, 장벽 강화",
    "desc": "피부 장벽을 구성하는 성분과 유사해 두피 보호막을 강화하고 세균이나 균의 증식을 억제한다. 민감하거나 여드름성 두피 관리에 적합하다.",
    "source": "system"
  },
  {
    "ko": "우레아",
    "en": "Urea",
    "cat": "두피",
    "mid": "각질제거",
    "role": "두피 각질 용해 / 수분 공급",
    "strength": "중",
    "feature": "각질 용해, 보습",
    "desc": "요소 성분으로 두피에 쌓인 각질을 부드럽게 녹이면서 동시에 수분을 공급한다. 두꺼운 각질층이나 건선성 두피 케어 제품에 활용된다.",
    "source": "system"
  },
  {
    "ko": "글리콜산",
    "en": "Glycolic Acid",
    "cat": "두피",
    "mid": "각질제거",
    "role": "두피 각질 박리 / 피부결 개선",
    "strength": "중",
    "feature": "AHA, 각질 박리",
    "desc": "가장 작은 AHA 성분으로 두피 표면 각질을 빠르게 녹여낸다. 모공이 막히거나 각질이 심한 두피에 효과적이지만 농도가 높으면 자극이 있다.",
    "source": "system"
  },
  {
    "ko": "만델산",
    "en": "Mandelic Acid",
    "cat": "두피",
    "mid": "각질제거",
    "role": "저자극 각질 제거 / 두피 결 개선",
    "strength": "약",
    "feature": "저자극 AHA, 각질 제거",
    "desc": "글리콜산보다 분자가 커서 흡수가 느리고 자극이 적은 AHA 성분이다. 민감한 두피에서도 각질을 부드럽게 제거할 수 있다.",
    "source": "system"
  },
  {
    "ko": "락토비온산",
    "en": "Lactobionic Acid",
    "cat": "두피",
    "mid": "각질제거",
    "role": "저자극 각질 제거 / 보습",
    "strength": "약",
    "feature": "저자극 PHA, 보습",
    "desc": "PHA 계열 성분으로 각질 제거와 보습 효과를 동시에 가진다. AHA보다 자극이 적어 예민한 두피에도 안전하게 사용할 수 있다.",
    "source": "system"
  },
  {
    "ko": "시스테인",
    "en": "Cysteine",
    "cat": "펌제",
    "mid": "환원제",
    "role": "모발 결합 환원 / 저자극 웨이브",
    "strength": "중",
    "feature": "저자극 환원, 웨이브",
    "desc": "모발의 핵심 아미노산인 시스테인을 환원제로 사용해 모발 결합을 부드럽게 풀어준다. 치오글리콜산보다 자극이 적고 시스틴 결합을 선택적으로 분해한다.",
    "source": "system"
  },
  {
    "ko": "아세틸시스테인",
    "en": "Acetylcysteine",
    "cat": "펌제",
    "mid": "환원제",
    "role": "모발 결합 분해 / 저취 환원",
    "strength": "약",
    "feature": "저자극 환원, 저취",
    "desc": "시스테인의 안정화 형태로 냄새가 적고 자극이 낮은 환원제다. 손상 모발이나 예민한 두피를 가진 고객에게 적합한 펌제에 사용된다.",
    "source": "system"
  },
  {
    "ko": "소듐 설파이트",
    "en": "Sodium Sulfite",
    "cat": "펌제",
    "mid": "환원제",
    "role": "모발 결합 분해 보조 / 산화 방지",
    "strength": "약",
    "feature": "환원 보조, 안정화",
    "desc": "약한 환원 작용과 산화 방지 기능을 가진다. 주 환원제의 효과를 안정적으로 유지하는 데 도움을 주는 보조 성분으로 사용된다.",
    "source": "system"
  },
  {
    "ko": "소듐 메타비설파이트",
    "en": "Sodium Metabisulfite",
    "cat": "펌제",
    "mid": "환원제",
    "role": "산화 방지 / 제품 안정화",
    "strength": "약",
    "feature": "산화 방지, 안정화",
    "desc": "환원제와 함께 사용되어 제품이 공기 중 산소에 의해 산화되는 것을 방지한다. 제품의 유통기한을 늘리고 사용 중 효과가 저하되지 않도록 돕는다.",
    "source": "system"
  },
  {
    "ko": "치오락트산",
    "en": "Thioglycolic Acid",
    "cat": "펌제",
    "mid": "환원제",
    "role": "모발 결합 분해 / 강한 웨이브",
    "strength": "강",
    "feature": "강한 환원, 웨이브",
    "desc": "치오글리콜산 암모늄의 산 형태로 모발 결합을 강하게 분해한다. 강한 작용력 때문에 저항성 모발이나 강한 웨이브가 필요한 경우에 사용된다.",
    "source": "system"
  },
  {
    "ko": "포타슘 브로메이트",
    "en": "Potassium Bromate",
    "cat": "펌제",
    "mid": "산화제",
    "role": "펌 2제 / 모발 결합 재형성",
    "strength": "중",
    "feature": "산화, 결합 고정",
    "desc": "소듐 브로메이트와 유사한 펌 2제 산화제로 1제에서 풀린 모발 결합을 원하는 형태로 고정한다. 과산화수소보다 모발 손상이 적은 편이다.",
    "source": "system"
  },
  {
    "ko": "과산화요소",
    "en": "Urea Peroxide",
    "cat": "염모제",
    "mid": "산화제",
    "role": "염료 산화 발색 / 탈색",
    "strength": "중",
    "feature": "산화 발색, 탈색",
    "desc": "요소와 과산화수소가 결합한 형태의 산화제로 과산화수소와 유사하게 작용한다. 탈색과 염색 모두에 사용되며 일반 과산화수소보다 안정적인 편이다.",
    "source": "system"
  },
  {
    "ko": "과산화나트륨",
    "en": "Sodium Perborate",
    "cat": "염모제",
    "mid": "산화제",
    "role": "탈색 파우더 산화 보조",
    "strength": "중",
    "feature": "산화 보조, 탈색",
    "desc": "탈색 파우더의 보조 산화제로 퍼설페이트와 함께 사용되어 탈색력을 높인다. 단독으로는 약하지만 다른 산화제와 조합하면 효과적이다.",
    "source": "system"
  },
  {
    "ko": "소듐 하이드록사이드",
    "en": "Sodium Hydroxide",
    "cat": "펌제",
    "mid": "알칼리",
    "role": "강한 알칼리 / 결합 분해",
    "strength": "강",
    "feature": "강알칼리, 결합 분해",
    "desc": "일명 양잿물로 매우 강한 알칼리 성분이다. 주로 화학적 스트레이트너(리락서)에 사용되어 모발 결합을 영구적으로 분해한다. 두피 접촉 시 화학화상을 일으킬 수 있어 전문가만 사용해야 한다.",
    "source": "system"
  },
  {
    "ko": "구아니딘 카보네이트",
    "en": "Guanidine Carbonate",
    "cat": "펌제",
    "mid": "알칼리",
    "role": "노-리이 스트레이트너 알칼리 성분",
    "strength": "강",
    "feature": "강알칼리, 영구 교정",
    "desc": "소듐 하이드록사이드보다 약하지만 여전히 강한 알칼리 성분이다. 노-리이(No-Lye) 스트레이트너의 주요 알칼리제로 두피 자극이 상대적으로 적다.",
    "source": "system"
  },
  {
    "ko": "암모니아 프리 알칼리 (알기닌)",
    "en": "Arginine HCl",
    "cat": "염모제",
    "mid": "알칼리",
    "role": "큐티클 팽창 / 암모니아 대체",
    "strength": "약",
    "feature": "저취 알칼리, 큐티클 개방",
    "desc": "아르기닌을 알칼리제로 사용해 큐티클을 열어주는 성분이다. 암모니아처럼 냄새가 나지 않아 암모니아 프리 염모제에 사용되는 대체 성분이다.",
    "source": "system"
  },
  {
    "ko": "소듐 카보네이트",
    "en": "Sodium Carbonate",
    "cat": "펌제",
    "mid": "알칼리",
    "role": "pH 조절 / 큐티클 팽창 보조",
    "strength": "중",
    "feature": "알칼리, pH 조절",
    "desc": "탄산나트륨으로 제품의 pH를 높여 큐티클이 부풀도록 만드는 알칼리제다. 단독으로 사용보다는 다른 알칼리 성분의 보조제로 사용되는 경우가 많다.",
    "source": "system"
  },
  {
    "ko": "다이에탄올아민",
    "en": "Diethanolamine",
    "cat": "염모제",
    "mid": "알칼리",
    "role": "염료 침투 유도 / 알칼리 조절",
    "strength": "중",
    "feature": "알칼리, 염료 침투",
    "desc": "에탄올아민과 유사한 알칼리 성분으로 큐티클을 열어 염료가 모발 내부로 들어갈 수 있게 한다. 사용량을 잘 조절해야 모발 손상을 줄일 수 있다.",
    "source": "system"
  },
  {
    "ko": "2-메틸레조시놀",
    "en": "2-Methylresorcinol",
    "cat": "염모제",
    "mid": "염료",
    "role": "갈색 계열 발색 / 색상 깊이",
    "strength": "중",
    "feature": "갈색 발색, 색상 깊이",
    "desc": "레조시놀 유도체로 PPD와 함께 사용되어 갈색 계열 색상에 깊이와 따뜻함을 더한다. 화학적으로 레조시놀보다 안정적인 편이다.",
    "source": "system"
  },
  {
    "ko": "4-아미노-2-하이드록시톨루엔",
    "en": "4-Amino-2-Hydroxytoluene",
    "cat": "염모제",
    "mid": "염료",
    "role": "붉은 계열 발색 보조",
    "strength": "약",
    "feature": "붉은 색조 보조",
    "desc": "PPD와 반응해 붉은 계열 색조를 만드는 커플러 성분이다. 단독 발색력은 약하지만 다른 염료와 조합하면 색상의 뉘앙스를 만든다.",
    "source": "system"
  },
  {
    "ko": "하이드로퀴논",
    "en": "Hydroquinone",
    "cat": "염모제",
    "mid": "탈색보조",
    "role": "모발 탈색 보조 / 멜라닌 억제",
    "strength": "강",
    "feature": "탈색 보조, 멜라닌 억제",
    "desc": "멜라닌 생성을 억제하고 모발 색소를 줄이는 효과가 있다. 탈색 제품에 일부 사용되지만 자극이 강해 두피에 직접 닿지 않도록 주의해야 한다.",
    "source": "system"
  },
  {
    "ko": "카민",
    "en": "Carmine",
    "cat": "염모제",
    "mid": "염료",
    "role": "붉은색 발색 / 천연 염료",
    "strength": "중",
    "feature": "천연 붉은색, 발색",
    "desc": "연지벌레에서 추출한 천연 붉은색 염료다. 화학 염료와 달리 산화 반응 없이 발색되며 일부 비건 제품에서는 제외된다.",
    "source": "system"
  },
  {
    "ko": "클로로필",
    "en": "Chlorophyll",
    "cat": "염모제",
    "mid": "염료",
    "role": "녹색 계열 발색 / 천연 염료",
    "strength": "약",
    "feature": "천연 녹색, 발색",
    "desc": "식물의 엽록소에서 추출한 녹색 천연 염료다. 단독 사용으로는 발색력이 약해 다른 성분과 혼합해 사용하는 경우가 많다.",
    "source": "system"
  },
  {
    "ko": "비트 루트 추출물",
    "en": "Beta Vulgaris Root Extract",
    "cat": "염모제",
    "mid": "염료",
    "role": "붉은보라 계열 천연 발색",
    "strength": "약",
    "feature": "천연 발색, 붉은보라",
    "desc": "비트에서 추출한 베타레인 색소로 붉은보라 계열 천연 발색이 가능하다. 세정 시 색이 빠지기 쉬운 단점이 있어 주로 반영구 또는 컬러 트리트먼트에 사용된다.",
    "source": "system"
  },
  {
    "ko": "사프란 추출물",
    "en": "Crocus Sativus Stigma Extract",
    "cat": "염모제",
    "mid": "염료",
    "role": "황금빛 색조 / 천연 발색",
    "strength": "약",
    "feature": "황금빛 천연 발색",
    "desc": "사프란에서 추출한 크로신 색소로 황금빛 노란 색조를 만든다. 매우 비싼 성분이라 고급 천연 염모 제품에 소량 사용된다.",
    "source": "system"
  },
  {
    "ko": "참나무 껍질 추출물",
    "en": "Quercus Robur Bark Extract",
    "cat": "염모제",
    "mid": "염료",
    "role": "갈색 계열 천연 발색 / 탈닌 성분",
    "strength": "약",
    "feature": "천연 갈색, 수렴",
    "desc": "참나무 껍질의 탄닌 성분이 갈색 계열 발색을 내고 모발 큐티클을 수렴하는 효과도 있다. 천연 헤어 컬러 제품에 헤나와 함께 자주 사용된다.",
    "source": "system"
  },
  {
    "ko": "월넛 껍질 추출물",
    "en": "Juglans Regia Shell Extract",
    "cat": "염모제",
    "mid": "염료",
    "role": "짙은 갈색~흑색 천연 발색",
    "strength": "중",
    "feature": "천연 갈색·흑색 발색",
    "desc": "호두 껍질에서 추출한 유글론 성분이 짙은 갈색이나 검은색 계열 발색을 낸다. 헤나와 함께 사용하면 더 짙은 색상을 만들 수 있다.",
    "source": "system"
  },
  {
    "ko": "인디고 카르민",
    "en": "Indigocarmine",
    "cat": "염모제",
    "mid": "염료",
    "role": "청색 계열 발색 / 색조 보조",
    "strength": "중",
    "feature": "청색 발색, 색조 보조",
    "desc": "합성 청색 염료로 모발에 파란 색조를 부여하거나 갈색·검은색 계열 색상에 깊이를 더하는 데 사용된다.",
    "source": "system"
  },
  {
    "ko": "락토페린",
    "en": "Lactoferrin",
    "cat": "두피",
    "mid": "항균",
    "role": "두피 항균 / 면역 보조",
    "strength": "약",
    "feature": "항균, 면역",
    "desc": "우유에서 추출한 철 결합 단백질로 두피의 세균이나 진균 증식을 억제한다. 두피 면역 기능을 지원하는 프리미엄 두피 케어 성분이다.",
    "source": "system"
  },
  {
    "ko": "석신산",
    "en": "Succinic Acid",
    "cat": "세정",
    "mid": "pH조절",
    "role": "제품 pH 조절 / 두피 각질 완화",
    "strength": "약",
    "feature": "pH 조절, 각질 완화",
    "desc": "호박산이라고도 불리며 제품의 pH를 조절하고 두피 각질을 부드럽게 만드는 데 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "타르타르산",
    "en": "Tartaric Acid",
    "cat": "세정",
    "mid": "pH조절",
    "role": "제품 pH 조절 / 산도 안정",
    "strength": "약",
    "feature": "pH 조절, 안정",
    "desc": "포도에서 유래한 천연 유기산으로 제품의 pH를 낮춰 안정성을 높인다. 천연 원료를 선호하는 제품에서 구연산 대신 활용되기도 한다.",
    "source": "system"
  },
  {
    "ko": "EDDS",
    "en": "Ethylenediamine Disuccinic Acid",
    "cat": "세정",
    "mid": "킬레이트제",
    "role": "미네랄 중화 / 생분해성 킬레이트",
    "strength": "약",
    "feature": "킬레이트, 생분해",
    "desc": "EDTA와 유사한 킬레이트제이지만 생분해가 가능한 친환경 성분이다. 수돗물 미네랄을 중화해 샴푸의 세정력과 거품을 안정적으로 유지한다.",
    "source": "system"
  },
  {
    "ko": "소듐 글루코네이트",
    "en": "Sodium Gluconate",
    "cat": "세정",
    "mid": "킬레이트제",
    "role": "미네랄 이온 중화 / 세정 보조",
    "strength": "약",
    "feature": "킬레이트, 세정 보조",
    "desc": "포도당에서 만든 친환경 킬레이트제로 물 속 칼슘·마그네슘 이온을 잡아 세정제 효과를 높인다.",
    "source": "system"
  },
  {
    "ko": "잔탄검",
    "en": "Xanthan Gum",
    "cat": "세정",
    "mid": "점도조절",
    "role": "제품 점도 안정 / 자연 유래 증점",
    "strength": "약",
    "feature": "점도 조절, 자연 유래",
    "desc": "옥수수 발효에서 만든 자연 유래 점도 조절제로 제품의 질감을 만들고 안정적으로 유지한다. 천연 제품에서 합성 점도제 대신 사용된다.",
    "source": "system"
  },
  {
    "ko": "하이드록시에틸아크릴레이트 코폴리머",
    "en": "Hydroxyethylacrylate/Sodium Acryloyldimethyl Taurate Copolymer",
    "cat": "세정",
    "mid": "점도조절",
    "role": "겔 질감 형성 / 제형 안정",
    "strength": "약",
    "feature": "겔 질감, 제형 안정",
    "desc": "세럼이나 겔 타입 두피 제품의 질감을 만드는 합성 폴리머다. 도포 시 끈적임이 적고 가벼운 겔 질감을 형성한다.",
    "source": "system"
  },
  {
    "ko": "셀룰로오스 검",
    "en": "Cellulose Gum",
    "cat": "세정",
    "mid": "점도조절",
    "role": "제품 점도 유지 / 자연 유래",
    "strength": "약",
    "feature": "점도 조절, 자연 유래",
    "desc": "면이나 목재 셀룰로오스에서 만든 자연 유래 점도제로 제품의 질감을 안정적으로 만든다. 보습 효과도 약간 있다.",
    "source": "system"
  },
  {
    "ko": "하이드록시프로필 구아",
    "en": "Hydroxypropyl Guar",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "모발 코팅 / 빗질 용이",
    "strength": "약",
    "feature": "코팅, 슬립감",
    "desc": "구아검을 변형한 성분으로 모발에 가볍게 코팅되어 빗질이 쉽게 되도록 만든다. 젖은 모발에서 엉킴을 줄이는 데 효과적이다.",
    "source": "system"
  },
  {
    "ko": "실리콘 쿼터늄-8",
    "en": "Silicone Quaternium-8",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "실리콘 코팅 + 정전기 방지",
    "strength": "중",
    "feature": "실리콘 코팅, 정전기 억제",
    "desc": "실리콘과 양이온이 결합한 성분으로 모발에 실리콘 코팅 효과와 정전기 방지 효과를 동시에 낸다. 손상 모발에 선택적으로 결합하는 특성이 있다.",
    "source": "system"
  },
  {
    "ko": "실리콘 쿼터늄-16",
    "en": "Silicone Quaternium-16",
    "cat": "크리닉",
    "mid": "코팅",
    "role": "지속력 있는 코팅 / 고광택",
    "strength": "중",
    "feature": "지속 코팅, 고광택",
    "desc": "양이온 실리콘의 고분자 버전으로 모발 표면에 강하고 지속력 있는 코팅막을 형성한다. 고광택 헤어 세럼이나 오일에 활용된다.",
    "source": "system"
  },
  {
    "ko": "메틸클로로이소치아졸리논",
    "en": "Methylchloroisothiazolinone",
    "cat": "세정",
    "mid": "보존제",
    "role": "세균·곰팡이 억제 / 방부",
    "strength": "강",
    "feature": "강한 방부, 살균",
    "desc": "MI/MCI로 불리는 강력한 방부제다. 낮은 농도에서도 세균과 곰팡이 억제 효과가 높지만 접촉성 알레르기를 유발할 수 있어 사용 농도 규제가 있다.",
    "source": "system"
  },
  {
    "ko": "다이아졸리디닐 우레아",
    "en": "Diazolidinyl Urea",
    "cat": "세정",
    "mid": "보존제",
    "role": "포름알데하이드 공여 방부 / 세균 억제",
    "strength": "중",
    "feature": "방부, 세균 억제",
    "desc": "포름알데하이드를 천천히 방출해 세균을 억제하는 방부제다. 효과적이지만 포름알데하이드 공여 성분이라 민감한 사람에게 자극이 있을 수 있다.",
    "source": "system"
  },
  {
    "ko": "클로르페네신",
    "en": "Chlorphenesin",
    "cat": "세정",
    "mid": "보존제",
    "role": "세균·진균 억제 / 방부",
    "strength": "중",
    "feature": "방부, 항균",
    "desc": "세균과 진균 모두를 억제하는 방부제로 페녹시에탄올과 함께 사용하면 보존 효과가 높아진다. 비교적 자극이 적은 편이다.",
    "source": "system"
  },
  {
    "ko": "부틸파라벤",
    "en": "Butylparaben",
    "cat": "세정",
    "mid": "보존제",
    "role": "곰팡이 억제 / 방부",
    "strength": "중",
    "feature": "방부, 곰팡이 억제",
    "desc": "파라벤 계열 방부제로 특히 진균과 효모 억제에 효과적이다. 환경호르몬 논란으로 많은 브랜드에서 사용을 줄이고 있지만 낮은 농도에서는 안전하다고 알려져 있다.",
    "source": "system"
  },
  {
    "ko": "메틸파라벤",
    "en": "Methylparaben",
    "cat": "세정",
    "mid": "보존제",
    "role": "세균 억제 / 방부",
    "strength": "약",
    "feature": "방부, 세균 억제",
    "desc": "가장 많이 사용되는 파라벤 계열 방부제로 세균 억제에 효과적이다. 단독 사용보다 다른 파라벤이나 방부제와 함께 사용해 효과를 높인다.",
    "source": "system"
  },
  {
    "ko": "소듐 에틸헥실글리세린",
    "en": "Sodium Ethylhexylglycerin",
    "cat": "세정",
    "mid": "보존제",
    "role": "방부 보조 / 보습",
    "strength": "약",
    "feature": "방부 보조, 보습",
    "desc": "에틸헥실글리세린의 소듐 형태로 방부 보조 효과와 보습 효과를 가진다. 자극이 적고 친환경 보존제로 분류된다.",
    "source": "system"
  },
  {
    "ko": "티타늄 다이옥사이드",
    "en": "Titanium Dioxide",
    "cat": "세정",
    "mid": "불투명제",
    "role": "제품 불투명화 / 색상 조절",
    "strength": "약",
    "feature": "불투명, 색상 조절",
    "desc": "샴푸나 컨디셔너를 불투명하게 만드는 성분이다. 흰색 펄감이나 불투명한 크림 질감을 원하는 제품에 사용된다.",
    "source": "system"
  },
  {
    "ko": "마이카",
    "en": "Mica",
    "cat": "염모제",
    "mid": "광택",
    "role": "모발 광택 / 광채 효과",
    "strength": "약",
    "feature": "광택, 광채",
    "desc": "천연 광물인 마이카를 미세하게 분쇄한 성분으로 모발에 반짝이는 광채 효과를 준다. 광택 스프레이나 글로스 제품에 많이 사용된다.",
    "source": "system"
  },
  {
    "ko": "구리 펩타이드",
    "en": "Copper Peptide",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "모낭 자극 / 두피 재생 촉진",
    "strength": "중",
    "feature": "모낭 활성, 재생",
    "desc": "구리 이온과 펩타이드가 결합한 성분으로 모낭 주변 혈액 순환과 조직 재생을 촉진한다. 탈모 방지와 모발 성장 촉진 목적의 프리미엄 두피 앰플에 사용된다.",
    "source": "system"
  },
  {
    "ko": "줄기세포 배양액",
    "en": "Human Adipose Stem Cell Conditioned Media",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "두피 재생 / 모낭 활성화",
    "strength": "강",
    "feature": "세포 재생, 모낭 활성",
    "desc": "줄기세포가 분비하는 성장인자를 활용해 두피 세포 재생과 모낭 활성화를 촉진한다. 탈모 케어 고기능 앰플이나 부스터에 사용되는 첨단 성분이다.",
    "source": "system"
  },
  {
    "ko": "식물 줄기세포 추출물",
    "en": "Plant Stem Cell Extract",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "두피 세포 보호 / 모낭 활성",
    "strength": "약",
    "feature": "세포 보호, 모낭 활성",
    "desc": "사과, 포도 등 식물 줄기세포에서 추출한 성분으로 두피 세포를 노화로부터 보호하고 모낭 활성화에 도움을 준다.",
    "source": "system"
  },
  {
    "ko": "EGF (표피성장인자)",
    "en": "Epidermal Growth Factor",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "두피 세포 재생 / 모발 성장 촉진",
    "strength": "강",
    "feature": "세포 재생, 성장 촉진",
    "desc": "피부와 두피 세포 재생을 촉진하는 성장인자다. 모낭 세포의 분열과 성장을 자극해 탈모 개선과 모발 성장 촉진에 효과적이다. 고기능 탈모 케어 앰플에 사용된다.",
    "source": "system"
  },
  {
    "ko": "FGF (섬유아세포성장인자)",
    "en": "Fibroblast Growth Factor",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "모낭 재생 / 혈관 형성 촉진",
    "strength": "강",
    "feature": "모낭 재생, 혈관 형성",
    "desc": "두피 내 혈관 형성을 촉진하고 모낭 세포 재생을 돕는 성장인자다. EGF와 함께 사용하면 탈모 개선 효과가 더욱 높아진다.",
    "source": "system"
  },
  {
    "ko": "엑소좀",
    "en": "Exosome",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "두피 세포 활성 / 모낭 재생",
    "strength": "강",
    "feature": "세포 활성, 재생",
    "desc": "세포 간 신호 전달을 담당하는 나노 입자로 두피 세포의 재생과 모낭 활성화를 촉진한다. 최신 탈모 케어 제품에 사용되는 첨단 성분이다.",
    "source": "system"
  },
  {
    "ko": "버드나무 껍질 추출물",
    "en": "Salix Alba Bark Extract",
    "cat": "두피",
    "mid": "각질제거",
    "role": "두피 자연 각질 제거 / 진정",
    "strength": "약",
    "feature": "자연 각질 제거, 진정",
    "desc": "버드나무 껍질에 포함된 살리신 성분이 두피 각질을 자연스럽게 제거하고 자극을 줄인다. 살리실산의 식물성 전구체로 두피 트러블 관리에 효과적이다.",
    "source": "system"
  },
  {
    "ko": "파파인",
    "en": "Papain",
    "cat": "두피",
    "mid": "각질제거",
    "role": "두피 단백질 각질 용해 / 모공 세정",
    "strength": "중",
    "feature": "효소 각질 제거, 모공 세정",
    "desc": "파파야에서 추출한 단백질 분해 효소로 두피에 쌓인 각질과 단백질 잔여물을 효소적으로 분해한다. 세정 후 두피가 부드럽고 가벼운 느낌이 든다.",
    "source": "system"
  },
  {
    "ko": "브로멜라인",
    "en": "Bromelain",
    "cat": "두피",
    "mid": "각질제거",
    "role": "두피 각질 효소 분해",
    "strength": "중",
    "feature": "효소 각질 제거",
    "desc": "파인애플에서 추출한 단백질 분해 효소로 두피 각질을 효소적으로 부드럽게 제거한다. 파파인보다 자극이 적고 민감한 두피에도 사용 가능하다.",
    "source": "system"
  },
  {
    "ko": "서브틸리신",
    "en": "Subtilisin",
    "cat": "두피",
    "mid": "각질제거",
    "role": "두피 각질 효소 제거 / 세정 보조",
    "strength": "약",
    "feature": "효소 각질 제거, 세정 보조",
    "desc": "발효 유래 단백질 분해 효소로 두피 각질을 부드럽게 분해한다. 저자극이어서 예민한 두피의 각질 관리에도 적합하다.",
    "source": "system"
  },
  {
    "ko": "아밀라아제",
    "en": "Amylase",
    "cat": "세정",
    "mid": "각질제거",
    "role": "두피 불순물 분해 / 세정 보조",
    "strength": "약",
    "feature": "효소 세정 보조",
    "desc": "전분을 분해하는 효소로 두피와 모발의 스타일링 제품 잔여물 제거를 돕는다. 효소 샴푸나 딥클렌징 제품에 사용된다.",
    "source": "system"
  },
  {
    "ko": "니코틴산",
    "en": "Nicotinic Acid",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 혈관 확장 / 혈행 촉진",
    "strength": "중",
    "feature": "혈관 확장, 혈행 촉진",
    "desc": "비타민 B3의 한 형태로 두피 혈관을 확장시켜 혈액 순환을 강하게 촉진한다. 도포 후 두피가 따뜻하게 달아오르는 느낌이 생기는 경우가 있다.",
    "source": "system"
  },
  {
    "ko": "프로카필",
    "en": "Procapil",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "탈모 예방 / 모근 강화",
    "strength": "중",
    "feature": "탈모 예방, 모근 강화",
    "desc": "바이오틴, 올레아놀산, 아피제닌을 혼합한 복합 탈모 케어 성분이다. 모낭을 활성화하고 모발 노화를 늦춰 탈모를 예방하는 것으로 알려져 있다.",
    "source": "system"
  },
  {
    "ko": "아나게인",
    "en": "Anagain",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "모발 성장 주기 촉진 / 탈모 감소",
    "strength": "중",
    "feature": "성장 주기 촉진, 탈모 감소",
    "desc": "완두 새싹에서 추출한 성분으로 모발 성장기를 촉진해 빠지는 모발을 줄이고 새 모발이 자라는 것을 돕는다.",
    "source": "system"
  },
  {
    "ko": "바이오채닌 A",
    "en": "Biochanin A",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "DHT 억제 / 탈모 예방",
    "strength": "중",
    "feature": "DHT 억제, 탈모 예방",
    "desc": "클로버에서 추출한 이소플라본 성분으로 탈모의 주원인인 DHT 생성을 억제한다. 남성형 탈모나 호르몬성 탈모 케어 제품에 활용된다.",
    "source": "system"
  },
  {
    "ko": "세렌오아 추출물",
    "en": "Serenoa Serrulata Fruit Extract",
    "cat": "두피",
    "mid": "탈모케어",
    "role": "DHT 억제 / 탈모 예방",
    "strength": "중",
    "feature": "DHT 억제, 탈모 예방",
    "desc": "쏘팔메토라고도 불리며 DHT를 생성하는 5알파 환원효소 억제 효과가 있다. 남성형 탈모 케어 제품에서 핵심 성분으로 사용된다.",
    "source": "system"
  },
  {
    "ko": "아연 피콜리네이트",
    "en": "Zinc Picolinate",
    "cat": "두피",
    "mid": "두피케어",
    "role": "두피 피지 조절 / 모발 성장 지원",
    "strength": "약",
    "feature": "피지 조절, 모발 성장",
    "desc": "흡수율이 높은 아연 성분으로 두피 피지 분비를 조절하고 모발 단백질 합성에 필요한 영양을 공급한다. 탈모 방지와 두피 트러블 케어에 활용된다.",
    "source": "system"
  },
  {
    "ko": "셀레늄 추출물",
    "en": "Selenium Extract",
    "cat": "두피",
    "mid": "항비듬",
    "role": "비듬 억제 / 두피 항산화",
    "strength": "중",
    "feature": "비듬 억제, 항산화",
    "desc": "셀레늄 화합물이 비듬 원인균 억제와 두피 항산화 효과를 동시에 낸다. 항비듬 샴푸의 유효 성분으로 사용된다.",
    "source": "system"
  },
  {
    "ko": "이황화셀레늄",
    "en": "Selenium Disulfide",
    "cat": "두피",
    "mid": "항비듬",
    "role": "비듬균 억제 / 두피 세정",
    "strength": "강",
    "feature": "강한 비듬 억제",
    "desc": "셀레늄 화합물로 비듬 원인균을 강하게 억제하는 항비듬 성분이다. 심한 비듬이나 지루성 두피염 관리 의약품 샴푸에 사용된다.",
    "source": "system"
  },
  {
    "ko": "콜타르 추출물",
    "en": "Coal Tar Extract",
    "cat": "두피",
    "mid": "항비듬",
    "role": "두피 과각질 억제 / 심한 비듬 케어",
    "strength": "강",
    "feature": "강한 각질 억제, 비듬 케어",
    "desc": "건선이나 심한 지루성 두피염 치료에 사용되는 성분이다. 두피 세포의 과도한 증식을 억제해 심한 각질과 비듬을 줄인다. 강한 성분이므로 전문가 상담 후 사용이 권장된다.",
    "source": "system"
  }
];

/* localStorage custom 성분 불러오기 */
(function loadSaved() {
  try {
    var saved = localStorage.getItem('shieldIngredients');
    if (saved) {
      var arr = JSON.parse(saved);
      INGREDIENTS = INGREDIENTS.concat(arr);
    }
  } catch(e) {}
})();

/* ── 상태 ── */
var currentFilter = '전체';
var editingIndex  = null; // 수정 중인 custom 성분 인덱스

/* ══════════════════════════════════════
   FILTER
══════════════════════════════════════ */
function setFilter(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  renderList();
}

/* ══════════════════════════════════════
   RENDER LIST
══════════════════════════════════════ */
function renderList() {
  var q    = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  var wrap = document.getElementById('listWrap');
  var info = document.getElementById('resultInfo');

  var filtered = INGREDIENTS.filter(function(item) {
    var matchCat = currentFilter === '전체' || item.cat === currentFilter;
    var matchQ   = !q ||
      (item.ko      && item.ko.toLowerCase().includes(q))  ||
      (item.en      && item.en.toLowerCase().includes(q))  ||
      (item.mid     && item.mid.toLowerCase().includes(q)) ||
      (item.role    && item.role.toLowerCase().includes(q))||
      (item.feature && item.feature.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  info.textContent = filtered.length + '개의 성분' + (q ? ' · "' + q + '" 검색 결과' : '');

  wrap.innerHTML = '';

  if (filtered.length === 0) {
    wrap.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">🔍</div>' +
        '<div class="empty-title">검색 결과가 없습니다</div>' +
        '<div class="empty-sub">다른 키워드나 필터로 검색해보세요</div>' +
      '</div>';
    return;
  }

  filtered.forEach(function(item, i) {
    var card = document.createElement('div');
    card.className = 'ing-card';
    card.style.animationDelay = Math.min(i * 0.025, 0.25) + 's';

    var strColor = item.strength === '약' ? '#3DAA6E'
                 : item.strength === '중' ? '#E0A030' : '#E05555';

    var customBadge = item.source === 'custom'
      ? '<span style="font-size:9px;font-weight:700;color:#888;background:#F0F0F0;padding:2px 7px;border-radius:8px;margin-left:4px;">MY</span>'
      : '';

    card.innerHTML =
      '<div class="card-top">' +
        '<div>' +
          '<div class="card-ko">' + esc(item.ko) + customBadge + '</div>' +
          (item.en ? '<div class="card-en">' + esc(item.en) + '</div>' : '') +
        '</div>' +
        '<div class="card-badges">' +
          (item.cat ? '<span class="badge badge-cat" data-cat="' + esc(item.cat) + '">' + esc(item.cat) + '</span>' : '') +
          (item.strength ? '<span style="font-size:10px;font-weight:700;color:' + strColor + '">강도 ' + esc(item.strength) + '</span>' : '') +
        '</div>' +
      '</div>' +
      (item.role ? '<div class="card-role">' + esc(item.role) + '</div>' : '') +
      '<div class="card-sub-row">' +
        (item.mid ? '<span class="card-mid">' + esc(item.mid) + '</span>' : '') +
        '<span class="card-arrow">›</span>' +
      '</div>';

    card.addEventListener('click', function() { openDetail(item); });
    wrap.appendChild(card);
  });
}

/* ══════════════════════════════════════
   DETAIL SHEET
══════════════════════════════════════ */
function openDetail(item) {
  document.getElementById('d-ko').textContent = item.ko || '';
  document.getElementById('d-en').textContent = item.en || '';

  var sc = item.strength === '약' ? '#3DAA6E'
         : item.strength === '중' ? '#E0A030' : '#E05555';

  var badges = '';
  if (item.cat)      badges += '<span class="badge badge-cat" data-cat="' + esc(item.cat) + '">' + esc(item.cat) + '</span> ';
  if (item.mid)      badges += '<span class="badge" style="background:var(--gray-100);color:var(--gray-600)">' + esc(item.mid) + '</span> ';
  if (item.strength) badges += '<span class="badge" style="background:' + sc + '22;color:' + sc + '">강도 ' + esc(item.strength) + '</span>';
  document.getElementById('d-badges').innerHTML = badges;

  document.getElementById('d-cat').textContent  = item.cat      || '-';
  document.getElementById('d-mid').textContent  = item.mid      || '-';
  document.getElementById('d-role').textContent = item.role     || '-';
  document.getElementById('d-str').textContent  = item.strength || '-';

  var featSec = document.getElementById('d-feat-section');
  if (item.feature) { featSec.style.display='block'; document.getElementById('d-feat').textContent = item.feature; }
  else { featSec.style.display='none'; }

  var descSec = document.getElementById('d-desc-section');
  if (item.desc) { descSec.style.display='block'; document.getElementById('d-desc').textContent = item.desc; }
  else { descSec.style.display='none'; }

  /* 수정/삭제 버튼 - custom만 표시 */
  var actionWrap = document.getElementById('d-actions');
  if (item.source === 'custom') {
    actionWrap.style.display = 'flex';
    document.getElementById('d-edit-btn').onclick   = function() { openEditModal(item); };
    document.getElementById('d-delete-btn').onclick = function() { deleteIngredient(item); };
  } else {
    actionWrap.style.display = 'none';
  }

  document.getElementById('detailOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════
   ADD MODAL
══════════════════════════════════════ */
function openAddModal() {
  editingIndex = null;
  document.getElementById('modal-mode-title').textContent = '성분 추가';
  ['f-ko','f-en','f-mid','f-role','f-feat','f-desc'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-cat').value = '';
  document.getElementById('f-str').value = '';
  document.getElementById('addOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(function() { document.getElementById('f-ko').focus(); }, 300);
}

function openEditModal(item) {
  closeDetail();
  editingIndex = INGREDIENTS.indexOf(item);
  document.getElementById('modal-mode-title').textContent = '성분 수정';
  document.getElementById('f-ko').value   = item.ko       || '';
  document.getElementById('f-en').value   = item.en       || '';
  document.getElementById('f-cat').value  = item.cat      || '';
  document.getElementById('f-mid').value  = item.mid      || '';
  document.getElementById('f-role').value = item.role     || '';
  document.getElementById('f-str').value  = item.strength || '';
  document.getElementById('f-feat').value = item.feature  || '';
  document.getElementById('f-desc').value = item.desc     || '';
  document.getElementById('addOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAddModal() {
  document.getElementById('addOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  editingIndex = null;
}

function saveIngredient() {
  var ko  = document.getElementById('f-ko').value.trim();
  var cat = document.getElementById('f-cat').value;
  if (!ko)  { alert('성분명(한글)을 입력해주세요.'); return; }
  if (!cat) { alert('대분류를 선택해주세요.'); return; }

  var item = {
    ko:       ko,
    en:       document.getElementById('f-en').value.trim(),
    cat:      cat,
    mid:      document.getElementById('f-mid').value.trim(),
    role:     document.getElementById('f-role').value.trim(),
    strength: document.getElementById('f-str').value,
    feature:  document.getElementById('f-feat').value.trim(),
    desc:     document.getElementById('f-desc').value.trim(),
    source:   'custom'
  };

  if (editingIndex !== null && editingIndex >= 0) {
    /* 수정 */
    INGREDIENTS[editingIndex] = item;
    showToast('✓  ' + ko + ' 수정됨');
  } else {
    /* 추가 */
    INGREDIENTS.push(item);
    showToast('✓  ' + ko + ' 저장됨');
  }

  /* custom 항목만 localStorage 저장 */
  var saved = INGREDIENTS.filter(function(i) { return i.source === 'custom'; });
  localStorage.setItem('shieldIngredients', JSON.stringify(saved));

  closeAddModal();
  renderList();
}

/* ══════════════════════════════════════
   DELETE
══════════════════════════════════════ */
function deleteIngredient(item) {
  if (!confirm('"' + item.ko + '" 성분을 삭제할까요?')) return;

  var idx = INGREDIENTS.indexOf(item);
  if (idx !== -1) { INGREDIENTS.splice(idx, 1); }

  var saved = INGREDIENTS.filter(function(i) { return i.source === 'custom'; });
  localStorage.setItem('shieldIngredients', JSON.stringify(saved));

  closeDetail();
  renderList();
  showToast('🗑  삭제됨');
}

/* ══════════════════════════════════════
   UTIL
══════════════════════════════════════ */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.getElementById('detailOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeDetail();
});
document.getElementById('addOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeAddModal();
});
