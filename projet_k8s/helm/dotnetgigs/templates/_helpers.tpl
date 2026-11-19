{{/*
=============================================================================
_helpers.tpl : fonctions réutilisables par les autres modèles
=============================================================================
Le "_" au début du nom indique à Helm que ce fichier ne produit aucune ressource :
il ne contient que des définitions ("define"), appelées ailleurs avec "include".
Cela évite de recopier les mêmes blocs dans chaque fichier.
"list a b" construit une liste de paramètres ; "index . 0" lit le 1er élément.
Les tirets dans "{{-" et "-}}" suppriment les espaces et retours à la ligne autour.
*/}}

{{/* Labels communs : project + app + tier. Usage : include "dotnetgigs.labels" (list "web" "frontend") */}}
{{- define "dotnetgigs.labels" -}}
project: dotnetgigs
app: {{ index . 0 }}
tier: {{ index . 1 }}
{{- end }}

{{/* Image d'une application du repo privé. Usage : include "dotnetgigs.image" (list $ .Values.web.tag)
     "$" = contexte racine du chart, nécessaire pour lire .Values à l'intérieur de la fonction.
     Résultat : nicoter04/dotnetgigs_bd:web */}}
{{- define "dotnetgigs.image" -}}
{{ (index . 0).Values.image.repository }}:{{ index . 1 }}
{{- end }}

{{/* Affinité "preferred" vers les pods d'une ou plusieurs apps. Usage : include "dotnetgigs.affinity" (list "sql-data")
     "range" boucle sur la liste : une préférence par application citée.
     topologyKey hostname = "sur le même nœud". Preferred = préférence, pas obligation. */}}
{{- define "dotnetgigs.affinity" -}}
affinity:
  podAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    {{- range . }}
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchLabels: { app: {{ . }} }
        topologyKey: kubernetes.io/hostname
    {{- end }}
{{- end }}
